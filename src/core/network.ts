import * as net from "net";
import * as os from "os";
export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const p = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(p));
    });
  });
}
export function networkAddresses(): string[] {
  let interfaces: ReturnType<typeof os.networkInterfaces>;
  try {
    interfaces = os.networkInterfaces();
  } catch {
    return [];
  }
  return Object.values(interfaces).flatMap((items) =>
    (items || [])
      .filter((i) => i.family === "IPv4" && !i.internal)
      .map((i) => i.address),
  );
}
export function advertisedHost(host: string): string {
  return host === "0.0.0.0" || host === "::"
    ? networkAddresses()[0] || "localhost"
    : host;
}
export function localTarget(value: string): URL {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error("Use an HTTP(S) localhost URL for the upstream server.");
  return url;
}
