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
test("Lite quick launch selects the current HTML/PHP file and preserves per-workspace parameters", async (t) => {
  const { quickLaunch } = require("../dist/core/quickLaunch");
  const root = await fixture(t);
  const html = path.join(root, "page.html");
  await fs.writeFile(html, "html");
  const settings = {
    root: "",
    entry: "",
    port: 5500,
    preview: "browser",
    liveEditing: true,
    upstream: "http://127.0.0.1:5173",
    runtime: "auto",
  };
  const spec = quickLaunch(root, html, settings);
  assert.equal(spec.mode, "static");
  assert.equal(spec.entry, "page.html");
  assert.equal(spec.host, "127.0.0.1");
  const php = path.join(root, "index.php");
  await fs.writeFile(php, "<?php");
  assert.equal(quickLaunch(root, php, settings).mode, "php");
  assert.equal(
    quickLaunch(root, html, settings, { ...spec, port: 7777 }).port,
    7777,
  );
  assert.throws(() =>
    quickLaunch(root, html, { ...settings, entry: "../escape.html" }),
  );
});
test("Lite visibility overrides auxiliary buttons while individual settings remain respected", () => {
  const { buttonVisibility } = require("../dist/ui/visibility");
  const settings = {
    mode: "full",
    start: true,
    qr: true,
    reopen: true,
    copy: true,
  };
  assert.deepEqual(buttonVisibility({ ...settings, mode: "lite" }, true), {
    start: true,
    qr: false,
    reopen: false,
    copy: false,
  });
  assert.deepEqual(buttonVisibility({ ...settings, start: false }, false), {
    start: false,
    qr: false,
    reopen: false,
    copy: false,
  });
  assert.equal(buttonVisibility({ ...settings, qr: false }, true).qr, false);
});
test("edit queue coalesces bursts by file, resolves all callers and continues after failures", async () => {
  const { CoalescingQueue } = require("../dist/core/coalescingQueue");
  const queue = new CoalescingQueue(10);
  let writes = 0,
    last;
  const work = [];
  for (let i = 0; i < 100; i++)
    work.push(
      queue.enqueue("same", async () => {
        writes++;
        last = i;
      }),
    );
  await Promise.all(work);
  assert.equal(writes, 1);
  assert.equal(last, 99);
  const failure = queue.enqueue("fail", async () => {
    throw new Error("disk failure");
  });
  await assert.rejects(failure, /disk failure/);
  await queue.enqueue("next", async () => {
    writes++;
  });
  assert.equal(writes, 2);
  await queue.flush();
});
test("mirror coalesces unsaved edits and avoids identical buffer rewrites", async (t) => {
  const root = await fixture(t);
  const file = path.join(root, "index.php");
  await fs.writeFile(file, "original");
  const copy = await mirror(root, () => {});
  t.after(() => copy.close());
  const original = fs.writeFile;
  let writes = 0;
  fs.writeFile = async function (target, ...args) {
    if (target === path.join(copy.root, "index.php")) writes++;
    return original.call(this, target, ...args);
  };
  try {
    await Promise.all(
      Array.from({ length: 100 }, (_, i) => copy.update(file, "buffer " + i)),
    );
    await copy.update(file, "buffer 99");
    assert.equal(writes, 1);
    assert.equal(await fs.readFile(file, "utf8"), "original");
  } finally {
    fs.writeFile = original;
  }
});
test("framework reload watcher can be disabled and per-request logs are opt-in", async (t) => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, "index.html"), "before");
  const logs = [];
  const s = await gateway({
    ...options(root),
    watchFiles: false,
    log: (m) => logs.push(m),
  });
  t.after(() => s.close());
  await (await fetch(s.url)).text();
  await fs.writeFile(path.join(root, "index.html"), "after");
  await new Promise((r) => setTimeout(r, 160));
  assert.equal(
    logs.some((m) => m.startsWith("Reload:") || m.startsWith("GET ")),
    false,
  );
  const verbose = await gateway({
    ...options(root),
    requestLogging: true,
    watchFiles: false,
    log: (m) => logs.push(m),
  });
  t.after(() => verbose.close());
  await (await fetch(verbose.url)).text();
  assert.ok(logs.some((m) => m.startsWith("GET ")));
});

test("LAN private URLs issue HttpOnly cookies and require authorization for files and WebSockets", async (t) => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, "index.html"), "<body>private</body>");
  const s = await gateway({
    ...options(root),
    host: "0.0.0.0",
    protectLAN: true,
  });
  t.after(() => s.close());
  const url = new URL(s.url);
  url.hostname = "127.0.0.1";
  assert.equal((await fetch(url.origin)).status, 401);
  const login = await fetch(url, { redirect: "manual" });
  assert.equal(login.status, 303);
  const cookie = login.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.equal(login.headers.get("location"), "/");
  const authorized = await fetch(url.origin, {
    headers: { cookie: cookie.split(";")[0] },
  });
  assert.match(await authorized.text(), /private/);
  const denied = new WebSocket(
    url.origin.replace("http:", "ws:") + "/__live_server_se/ws",
  );
  await new Promise((resolve) => denied.once("error", resolve));
  const { entryUrl } = require("../dist/core/paths");
  const entry = new URL(entryUrl(s.url, "folder/a b.html"));
  assert.equal(entry.pathname, "/folder/a%20b.html");
  assert.ok(entry.searchParams.get("__live_server_token"));
});

test("API prefix proxy forwards bodies and queries without injecting HTML or forwarding access cookies", async (t) => {
  const root = await fixture(t);
  const backend = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.setHeader("content-type", "text/html");
      res.end(
        JSON.stringify({ url: req.url, body, cookie: req.headers.cookie }),
      );
    });
  });
  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => backend.close(resolve)));
  const target = "http://127.0.0.1:" + backend.address().port;
  const s = await gateway({
    ...options(root),
    apiProxy: [{ prefix: "/api", target, stripPrefix: true }],
  });
  t.after(() => s.close());
  const response = await fetch(s.url + "/api/users?q=1", {
    method: "POST",
    body: "payload",
    headers: { cookie: "live_server_se_secret=secret; app=yes" },
  });
  const data = await response.json();
  assert.deepEqual(data, {
    url: "/users?q=1",
    body: "payload",
    cookie: "app=yes",
  });
  const exact = await fetch(s.url + "/api?q=2");
  assert.equal((await exact.json()).url, "/?q=2");
  const { apiRoutes } = require("../dist/server/apiRoutes");
  assert.throws(() =>
    apiRoutes([{ prefix: "/api", target: "https://example.com" }]),
  );
  assert.throws(() =>
    apiRoutes([{ prefix: "/api", target: target + "/path" }]),
  );
});

test("browser console relay accepts bounded events and ignores malformed messages", async (t) => {
  const root = await fixture(t),
    logs = [];
  const s = await gateway({
    ...options(root),
    browserConsole: true,
    log: (m) => logs.push(m),
  });
  t.after(() => s.close());
  const ws = new WebSocket(
    s.url.replace("http:", "ws:") + "/__live_server_se/ws",
  );
  t.after(() => ws.terminate());
  await new Promise((resolve) => ws.once("open", resolve));
  ws.send("bad json");
  ws.send(
    JSON.stringify({
      type: "console",
      level: "error",
      message: "runtime error",
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok(logs.some((m) => m === "[Browser error] runtime error"));
});

test("explicit CSS/JS injection serves only configured files and uses editor overlays", async (t) => {
  const root = await fixture(t);
  const file = path.join(root, "extra.css");
  await fs.writeFile(file, "body{color:red}");
  const s = await gateway({
    ...options(root),
    injectedFiles: [file],
    readFile: (target) => (target === file ? "body{color:blue}" : undefined),
  });
  t.after(() => s.close());
  const client = await (
    await fetch(s.url + "/__live_server_se/client.js")
  ).text();
  assert.match(client, /injected\/0/);
  new (require("node:vm").Script)(client);
  assert.equal(
    await (await fetch(s.url + "/__live_server_se/injected/0")).text(),
    "body{color:blue}",
  );
  assert.equal(
    (await fetch(s.url + "/__live_server_se/injected/1")).status,
    404,
  );
  const { responsiveScript } = require("../dist/ui/responsive");
  new (require("node:vm").Script)("const frame={};" + responsiveScript);
});
