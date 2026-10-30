import express from "express";
import { access } from "./access";
import { apiRoutes, ApiRoute } from "./apiRoutes";
import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import { Socket } from "net";
import { WebSocketServer, WebSocket } from "ws";
import httpProxy from "http-proxy";
import { safePath, inside } from "../core/paths";
import { advertisedHost } from "../core/network";
import { Running } from "../core/types";
import { inject } from "./inject";
import { proxyRequest } from "./proxy";
import { watch } from "./watcher";
export interface GatewayOptions {
  root: string;
  protectLAN?: boolean;
  injectedFiles?: string[];
  browserConsole?: boolean;
  apiProxy?: ApiRoute[];
  port: number;
  host: string;
  media: string;
  tls?: { key: Buffer | string; cert: Buffer | string };
  upstream?: URL;
  protectFiles?: boolean;
  watchFiles?: boolean;
  requestLogging?: boolean;
  spa: boolean;
  debounce: number;
  polling: boolean;
  ignored: string[];
  extensions: string[];
  headers: Record<string, string>;
  log: (m: string) => void;
  readFile?: (file: string) => string | undefined;
}
export async function gateway(o: GatewayOptions): Promise<Running> {
  const root = fs.realpathSync(o.root),
    app = express();
  app.disable("x-powered-by");
  const guard = access(
    o.protectLAN === true &&
      !["127.0.0.1", "localhost", "::1"].includes(o.host),
    Boolean(o.tls),
  );
  const routes = apiRoutes(o.apiProxy || []);
  app.use((req, res, next) => {
    if (guard.handle(req, res)) next();
  });
  const server = o.tls
    ? https.createServer(o.tls, app)
    : http.createServer(app);
  const sockets = new Set<Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  const ws = new WebSocketServer({ noServer: true, maxPayload: 16384 });
  const hmr = httpProxy.createProxyServer({ ws: true });
  hmr.on("error", (error) => o.log("HMR proxy: " + error));
  server.on("upgrade", (req, socket, head) => {
    if (!guard.authorized(req)) {
      socket.destroy();
      return;
    }
    if (
      (req.url || "").split("?")[0] === "/__live_server_se/ws" &&
      req.headers.origin
    ) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host) {
          socket.destroy();
          return;
        }
      } catch {
        socket.destroy();
        return;
      }
    }
    if ((req.url || "").split("?")[0] === "/__live_server_se/ws")
      ws.handleUpgrade(req, socket, head, (client) =>
        ws.emit("connection", client, req),
      );
    else if (o.upstream)
      hmr.ws(req, socket, head, { target: o.upstream.origin });
    else socket.destroy();
  });
  const heartbeat = setInterval(() => {
    ws.clients.forEach((client) => {
      if ((client as any).alive === false) {
        client.terminate();
        return;
      }
      (client as any).alive = false;
      client.ping();
    });
  }, 30000);
  ws.on("connection", (client) => {
    (client as any).alive = true;
    client.on("pong", () => {
      (client as any).alive = true;
    });
    client.on("error", (e) => o.log("WebSocket: " + e));
    let count = 0,
      start = Date.now();
    client.on("message", (raw) => {
      if (!o.browserConsole) return;
      if (Date.now() - start > 1000) {
        start = Date.now();
        count = 0;
      }
      if (++count > 20) return;
      try {
        const event = JSON.parse(String(raw));
        if (
          event.type === "console" &&
          ["log", "warn", "error", "info"].includes(event.level)
        )
          o.log(
            `[Browser ${event.level}] ${String(event.message)
              .slice(0, 4000)
              .replace(/[\r\n]/g, " ")}`,
          );
      } catch {}
    });
  });
  app.use((req, res, next) => {
    for (const [key, value] of Object.entries(o.headers))
      res.setHeader(key, value);
    res.on("finish", () => {
      if (o.requestLogging || res.statusCode >= 400)
        o.log(req.method + " " + req.path + " " + res.statusCode);
    });
    next();
  });
  app.get("/__live_server_se/injected/:index", (req, res) => {
    const file = (o.injectedFiles || [])[Number(req.params.index)];
    if (!file || !/^\d+$/.test(req.params.index)) {
      res.status(404).end();
      return;
    }
    res.type(path.extname(file)).setHeader("Cache-Control", "no-store");
    const overlay = o.readFile?.(file);
    if (overlay !== undefined) res.send(overlay);
    else res.sendFile(file);
  });
  app.get("/__live_server_se/client.js", (_req, res) => {
    res.type("application/javascript").setHeader("Cache-Control", "no-store");
    const files = (o.injectedFiles || []).map((file, index) => ({
      url: "/__live_server_se/injected/" + index,
      css: /\.css$/i.test(file),
    }));
    const bootstrap =
      "window.__liveServerSEConsole=" +
      Boolean(o.browserConsole) +
      ";" +
      JSON.stringify(files) +
      `.forEach(f=>{const e=document.createElement(f.css?'link':'script');if(f.css){e.rel='stylesheet';e.href=f.url;}else{e.src=f.url;e.async=false;}document.head.appendChild(e);});\n`;
    res.send(
      bootstrap + fs.readFileSync(path.join(o.media, "reload.js"), "utf8"),
    );
  });
  app.use((req, res, next) => {
    const route = routes.find(
      (r) => req.path === r.prefix || req.path.startsWith(r.prefix + "/"),
    );
    if (route) {
      if (route.stripPrefix) {
        const rest = req.url.slice(route.prefix.length);
        req.url = rest.startsWith("/") ? rest : "/" + rest;
      }
      proxyRequest(route.target, req, res, o.log, false);
      return;
    }
    if (o.upstream && !o.protectFiles) {
      proxyRequest(o.upstream, req, res, o.log);
      return;
    }
    const file = safePath(root, req.originalUrl);
    if (!file) {
      res.status(403).send("Forbidden path");
      return;
    }
    const overlay = o.readFile?.(file);
    if (
      overlay !== undefined &&
      /\.(html?|css|[cm]?js|json|svg|txt|xml)$/i.test(file)
    ) {
      res.type(path.extname(file)).setHeader("Cache-Control", "no-store");
      res.send(/\.html?$/i.test(file) ? inject(overlay) : overlay);
      return;
    }
    if (o.protectFiles && /\.(inc|phar)$/i.test(file)) {
      res.status(403).end("Forbidden source file");
      return;
    }
    if (o.upstream) {
      proxyRequest(o.upstream, req, res, o.log);
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.status(405).end();
      return;
    }
    let candidate = file;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory())
      candidate = path.join(candidate, "index.html");
    if (fs.existsSync(candidate) && !inside(root, fs.realpathSync(candidate))) {
      res.status(403).end("Forbidden path");
      return;
    }
    if (fs.existsSync(candidate) && /\.html?$/i.test(candidate)) {
      res.type("html").setHeader("Cache-Control", "no-store");
      res.send(inject(fs.readFileSync(candidate, "utf8")));
      return;
    }
    if (/\.(php[0-9]?|phtml|phar|inc)$/i.test(candidate)) {
      res.status(404).send("Select PHP mode to execute PHP files.");
      return;
    }
    next();
  });
  app.use(express.static(root, { index: false, dotfiles: "deny" }));
  app.use((req, res) => {
    const index = safePath(root, "/index.html");
    if (
      o.spa &&
      req.accepts("html") &&
      !path.extname(req.path) &&
      index &&
      fs.existsSync(index)
    ) {
      res.type("html").setHeader("Cache-Control", "no-store");
      res.send(inject(fs.readFileSync(index, "utf8")));
    } else res.status(404).type("text").send("404 — File not found");
  });
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      o.log(String(err));
      res.status(500).end("Server error. See logs.");
    },
  );
  let stopWatching: (() => Promise<void>) | undefined;
  const cleanup = async () => {
    clearInterval(heartbeat);
    if (stopWatching) await stopWatching();
    ws.clients.forEach((c) => c.terminate());
    ws.close();
    hmr.close();
    sockets.forEach((s) => s.destroy());
  };
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(o.port, o.host, () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
    if (o.watchFiles !== false)
      stopWatching = watch(
        root,
        o,
        (paths) => {
          o.log("Reload: " + paths.join(", "));
          const data = JSON.stringify({ type: "reload", paths });
          ws.clients.forEach((c) => {
            if (c.readyState === WebSocket.OPEN) c.send(data);
          });
        },
        o.log,
      );
  } catch (error) {
    await cleanup();
    throw error;
  }
  server.on("error", (error) => o.log(String(error)));
  const port = (server.address() as import("net").AddressInfo).port;
  const host = advertisedHost(o.host);
  let closed = false;
  const reload = (paths: string[]) => {
    const data = JSON.stringify({ type: "reload", paths });
    ws.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN) c.send(data);
    });
  };
  return {
    reload,
    url: `http${o.tls ? "s" : ""}://${host.includes(":") ? "[" + host + "]" : host}:${port}${guard.token ? "/?__live_server_token=" + guard.token : ""}`,
    close: async () => {
      if (closed) return;
      closed = true;
      await cleanup();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
