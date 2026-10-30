import { randomBytes, timingSafeEqual } from "crypto";
import { IncomingMessage, ServerResponse } from "http";
export function access(enabled: boolean, secure: boolean) {
  const token = enabled ? randomBytes(24).toString("hex") : "";
  const name = "live_server_se_" + token.slice(0, 12);
  const valid = (value: string) => {
    const a = Buffer.from(value);
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  };
  const authorized = (req: IncomingMessage) =>
    !enabled ||
    (req.headers.cookie || "").split(";").some((c) => {
      const [key, value] = c.trim().split("=");
      return key === name && valid(value || "");
    });
  return {
    token,
    authorized,
    handle(req: IncomingMessage, res: ServerResponse) {
      res.setHeader("Referrer-Policy", "no-referrer");
      if (authorized(req)) return true;
      const url = new URL(req.url || "/", "http://localhost");
      if (valid(url.searchParams.get("__live_server_token") || "")) {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader(
          "Set-Cookie",
          `${name}=${token}; HttpOnly; Path=/; SameSite=${secure ? "None; Secure" : "Lax"}`,
        );
        url.searchParams.delete("__live_server_token");
        res.writeHead(303, { Location: url.pathname + url.search });
        res.end();
        return false;
      }
      res.writeHead(401, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end("Open the private URL or scan the QR code from Live Server SE.");
      return false;
    },
  };
}
