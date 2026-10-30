import * as http from "http";
import * as https from "https";
import { inject } from "./inject";
export function proxyRequest(
  target: URL,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  log: (m: string) => void,
) {
  const headers = {
    ...req.headers,
    host: target.host,
    "accept-encoding": "identity",
  };
  const upstream = (target.protocol === "https:" ? https : http).request(
    new URL(req.url || "/", target),
    { method: req.method, headers },
    (incoming) => {
      const responseHeaders = { ...incoming.headers };
      if (
        String(incoming.headers["content-type"]).includes("text/html") &&
        !String(incoming.headers["content-disposition"]).includes(
          "attachment",
        ) &&
        !incoming.headers["content-encoding"]
      ) {
        delete responseHeaders["content-length"];
        delete responseHeaders.etag;
        responseHeaders["cache-control"] = "no-store";
        const chunks: Buffer[] = [];
        let size = 0;
        incoming.on("data", (chunk) => {
          size += chunk.length;
          if (size > 16 * 1024 * 1024) {
            incoming.destroy(new Error("HTML response exceeds 16 MiB"));
            return;
          }
          chunks.push(chunk);
        });
        incoming.on("error", (e) => {
          log(String(e));
          if (!res.headersSent) res.writeHead(502);
          res.end("Upstream response failed");
        });
        incoming.on("end", () => {
          if (res.writableEnded) return;
          res.writeHead(incoming.statusCode || 200, responseHeaders);
          res.end(inject(Buffer.concat(chunks).toString("utf8")));
        });
      } else {
        res.writeHead(incoming.statusCode || 200, responseHeaders);
        incoming.pipe(res);
      }
    },
  );
  upstream.on("error", (error) => {
    log(String(error));
    if (!res.headersSent) res.writeHead(502);
    res.end("Upstream server is unavailable. See Live Server logs.");
  });
  req.on("aborted", () => upstream.destroy());
  req.pipe(upstream);
}
