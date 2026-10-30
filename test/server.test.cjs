const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path"),
  http = require("node:http");
const { WebSocket } = require("ws");
const { gateway } = require("../dist/server/gateway");
const { inject } = require("../dist/server/inject");
const { mirror } = require("../dist/runtime/mirror");
const { launch } = require("../dist/runtime/launch");
const { localTarget } = require("../dist/core/network");
const { detectProject } = require("../dist/projectDetector");
const media = path.resolve("media");
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "se-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
const options = (root) => ({
  root,
  port: 0,
  host: "127.0.0.1",
  media,
  spa: true,
  debounce: 50,
  polling: false,
  ignored: [],
  extensions: [],
  headers: {},
  log: () => {},
});
function raw(url, requestPath) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    http
      .get({ hostname: u.hostname, port: u.port, path: requestPath }, (r) => {
        let body = "";
        r.on("data", (c) => (body += c));
        r.on("end", () => resolve({ status: r.statusCode, body }));
      })
      .on("error", reject);
  });
}
test("HTML queries, nested indexes, SPA, protected files, shutdown and occupied ports", async (t) => {
  const root = await fixture(t);
  await fs.mkdir(path.join(root, "nested"));
  await fs.writeFile(path.join(root, "index.html"), "<body>hello</BODY>");
  await fs.writeFile(
    path.join(root, "nested/index.html"),
    "<body>nested</body>",
  );
  await fs.writeFile(path.join(root, "secret.php"), "<?php secret ?>");
  await fs.writeFile(path.join(root, ".env"), "SECRET=1");
  const s = await gateway(options(root));
  t.after(() => s.close());
  for (const p of ["/index.html?v=1", "/nested/", "/route"]) {
    const response = await fetch(s.url + p);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /__live_server_se\/client.js/);
  }
  for (const p of [
    "/../other.html",
    "/%2e%2e/other.html",
    "/.env",
    "/node_modules/pkg/file.js",
    "/x%00.html",
  ])
    assert.equal((await raw(s.url, p)).status, 403);
  assert.equal((await fetch(s.url + "/secret.php")).status, 404);
  await assert.rejects(() =>
    gateway({ ...options(root), port: Number(new URL(s.url).port) }),
  );
  const port = Number(new URL(s.url).port);
  await s.close();
  const next = await gateway({ ...options(root), port });
  await next.close();
});
test("symlink escape rejected, including directory index symlinks", async (t) => {
  const root = await fixture(t),
    outside = await fixture(t);
  await fs.writeFile(path.join(outside, "secret.html"), "secret");
  try {
    await fs.symlink(
      outside,
      path.join(root, "escape"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await fs.symlink(
      path.join(outside, "secret.html"),
      path.join(root, "index.html"),
    );
  } catch (e) {
    if (e.code === "EPERM") {
      t.skip("Symlink permission unavailable");
      return;
    }
    throw e;
  }
  const s = await gateway(options(root));
  t.after(() => s.close());
  assert.equal((await fetch(s.url + "/escape/secret.html")).status, 403);
  assert.equal((await fetch(s.url + "/")).status, 403);
});
test("file edits broadcast through WebSocket and watcher is released", async (t) => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, "index.html"), "before");
  const s = await gateway(options(root));
  const ws = new WebSocket(
    s.url.replace("http:", "ws:") + "/__live_server_se/ws",
  );
  t.after(() => s.close());
  await new Promise((r) => ws.once("open", r));
  await new Promise((r) => setTimeout(r, 200));
  const received = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("No reload event")), 3000);
    ws.once("message", (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(String(data)));
    });
  });
  await fs.writeFile(path.join(root, "index.html"), "after");
  assert.deepEqual((await received).paths, ["index.html"]);
  const closed = new Promise((r) => ws.once("close", r));
  await s.close();
  await closed;
  assert.equal(ws.readyState, WebSocket.CLOSED);
});
test("proxy preserves framework responses, HEAD metadata and HMR upgrades", async (t) => {
  const root = await fixture(t);
  const upstream = http.createServer((req, res) => {
    if (req.url === "/download") {
      res.writeHead(200, {
        "Content-Disposition": 'attachment; filename="example.zip"',
        "Content-Length": "123",
        "Content-Type": "application/zip",
      });
      res.end(req.method === "HEAD" ? undefined : Buffer.alloc(123));
    } else {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<body>framework</body>");
    }
  });
  const { WebSocketServer } = require("ws");
  const wss = new WebSocketServer({ server: upstream });
  wss.on("connection", (c) => c.send("hmr"));
  await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
  const target = new URL("http://127.0.0.1:" + upstream.address().port);
  const s = await gateway({ ...options(root), upstream: target });
  t.after(async () => {
    await s.close();
    wss.clients.forEach((c) => c.terminate());
    wss.close();
    await new Promise((r) => upstream.close(r));
  });
  assert.match(await (await fetch(s.url)).text(), /client.js/);
  const head = await fetch(s.url + "/download", { method: "HEAD" });
  assert.equal(head.headers.get("content-length"), "123");
  assert.equal(await head.text(), "");
  const ws = new WebSocket(s.url.replace("http:", "ws:") + "/framework-hmr");
  assert.equal(
    await new Promise((r) => ws.once("message", (m) => r(String(m)))),
    "hmr",
  );
  ws.terminate();
});
test("live editing copy reflects unsaved buffers without modifying originals", async (t) => {
  const root = await fixture(t);
  const file = path.join(root, "index.php");
  await fs.writeFile(file, "original");
  const copy = await mirror(root, () => {});
  t.after(() => copy.close());
  await copy.update(file, "unsaved");
  assert.equal(
    await fs.readFile(path.join(copy.root, "index.php"), "utf8"),
    "unsaved",
  );
  assert.equal(await fs.readFile(file, "utf8"), "original");
  await fs.writeFile(file, "saved");
  await copy.update(file);
  assert.equal(
    await fs.readFile(path.join(copy.root, "index.php"), "utf8"),
    "saved",
  );
});
test("PHP executes and live copy applies unsaved PHP edits", async (t) => {
  const { spawnSync } = require("node:child_process");
  if (spawnSync("php", ["--version"]).status !== 0) {
    t.skip("PHP CLI not installed");
    return;
  }
  const root = await fixture(t);
  const file = path.join(root, "index.php");
  await fs.writeFile(file, '<?php echo "before"; ?>');
  const s = await launch(
    {
      workspace: root,
      root,
      entry: "index.php",
      mode: "php",
      port: 0,
      host: "127.0.0.1",
      https: false,
      preview: "browser",
      instant: true,
    },
    { ...options(root), php: "php", packageManager: "npm" },
  );
  t.after(() => s.close());
  assert.match(await (await fetch(s.url + "/index.php")).text(), /before/);
  await s.update(file, '<?php echo "unsaved PHP"; ?>');
  assert.match(await (await fetch(s.url + "/index.php")).text(), /unsaved PHP/);
  assert.match(await fs.readFile(file, "utf8"), /before/);
  await s.close();
});
test("build detection prefers built entry and does not classify CRA public as build", async (t) => {
  const root = await fixture(t);
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      dependencies: { react: "*" },
      scripts: { start: "react-scripts start" },
    }),
  );
  await fs.mkdir(path.join(root, "public"));
  await fs.writeFile(path.join(root, "public/index.html"), "template");
  assert.equal(detectProject(root).buildDirectory, null);
  await fs.mkdir(path.join(root, "dist"));
  await fs.writeFile(path.join(root, "dist/index.html"), "built");
  await fs.writeFile(path.join(root, "index.html"), "source");
  assert.equal(detectProject(root).entryFile, path.join("dist", "index.html"));
});
test("injection is idempotent; remote upstreams rejected; browser scripts contain valid JS", async () => {
  assert.equal(inject(inject("<BODY>x</BODY>")).match(/client.js/g).length, 1);
  assert.throws(() => localTarget("https://example.com"));
  new (require("node:vm").Script)(await fs.readFile("media/reload.js", "utf8"));
});
test("Vite transforms React TSX from the unsaved live editing copy and child shuts down", async (t) => {
  const root = await fixture(t);
  const { freePort } = require("../dist/core/network");
  const port = await freePort();
  await fs.symlink(
    path.resolve("node_modules"),
    path.join(root, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      type: "module",
      scripts: { dev: `vite --host 127.0.0.1 --port ${port} --strictPort` },
    }),
  );
  await fs.writeFile(
    path.join(root, "index.html"),
    '<div id="root"></div><script type="module" src="/main.tsx"></script>',
  );
  const file = path.join(root, "main.tsx");
  await fs.writeFile(
    file,
    'import React from "react"; export default <div>before</div>;',
  );
  const s = await launch(
    {
      workspace: root,
      root,
      entry: "",
      mode: "framework",
      port: 0,
      host: "127.0.0.1",
      https: false,
      preview: "browser",
      instant: true,
      script: "dev",
      upstream: `http://127.0.0.1:${port}`,
    },
    { ...options(root), php: "php", packageManager: "npm" },
  );
  t.after(() => s.close());
  const transformed = await (await fetch(s.url + "/main.tsx")).text();
  assert.match(transformed, /before/);
  const dependency = transformed.match(/from "([^" ]*node_modules[^" ]*)"/);
  assert.ok(dependency, "Vite should emit a dependency URL");
  assert.equal((await fetch(new URL(dependency[1], s.url))).status, 200);
  await s.update(
    file,
    'import React from "react"; export default <div>unsaved React TSX</div>;',
  );
  await new Promise((r) => setTimeout(r, 300));
  assert.match(
    await (await fetch(s.url + "/main.tsx")).text(),
    /unsaved React TSX/,
  );
  assert.match(await fs.readFile(file, "utf8"), /before/);
  await s.close();
  await assert.rejects(() => fetch(`http://127.0.0.1:${port}`));
});
test("WebView download link inspection requests only HEAD and emits metadata", async () => {
  const vm = require("node:vm");
  let click;
  const messages = [];
  const requests = [];
  const context = {
    window: {},
    parent: { postMessage: (m) => messages.push(m) },
    location: {
      protocol: "http:",
      host: "localhost:5500",
      origin: "http://localhost:5500",
      href: "http://localhost:5500/index.html",
      pathname: "/index.html",
    },
    sessionStorage: { getItem: () => null },
    document: { addEventListener: (_type, fn) => (click = fn) },
    WebSocket: class {},
    URL,
    console,
    setTimeout,
    clearTimeout,
    addEventListener: () => {},
    fetch: async (_url, init) => {
      requests.push(init.method);
      return {
        headers: {
          get: (name) =>
            ({
              "content-disposition": 'attachment; filename="sample.zip"',
              "content-length": "4096",
              "content-type": "application/zip",
            })[name] || null,
        },
      };
    },
  };
  vm.runInNewContext(await fs.readFile("media/reload.js", "utf8"), context);
  let prevented = false;
  await click({
    button: 0,
    preventDefault: () => (prevented = true),
    target: {
      closest: () => ({
        href: "http://localhost:5500/file",
        hasAttribute: () => false,
        getAttribute: () => null,
      }),
    },
  });
  assert.equal(prevented, true);
  assert.deepEqual(requests, ["HEAD"]);
  assert.equal(messages[0].name, "sample.zip");
  assert.equal(messages[0].size, 4096);
});
test("unsaved static document and resource overlays are served without disk writes", async (t) => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, "page.htm"), "<body>saved</body>");
  await fs.writeFile(path.join(root, "data.json"), "{}");
  const s = await gateway({
    ...options(root),
    readFile: (file) =>
      file.endsWith("page.htm")
        ? "<body>unsaved</body>"
        : file.endsWith("data.json")
          ? '{"unsaved":true}'
          : undefined,
  });
  t.after(() => s.close());
  const html = await (await fetch(s.url + "/page.htm")).text();
  assert.match(html, /unsaved/);
  assert.match(html, /client.js/);
  assert.deepEqual(await (await fetch(s.url + "/data.json")).json(), {
    unsaved: true,
  });
  assert.match(await fs.readFile(path.join(root, "page.htm"), "utf8"), /saved/);
});
