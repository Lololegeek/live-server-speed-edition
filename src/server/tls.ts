import * as fs from "fs";
import * as path from "path";
import selfsigned from "selfsigned";
export function certificate(storage: string, cert?: string, key?: string) {
  if (Boolean(cert) !== Boolean(key))
    throw new Error("Both TLS certificate and private key are required.");
  if (cert && key)
    return { cert: fs.readFileSync(cert), key: fs.readFileSync(key) };
  fs.mkdirSync(storage, { recursive: true });
  const certFile = path.join(storage, "cert.pem"),
    keyFile = path.join(storage, "key.pem");
  if (
    !fs.existsSync(certFile) ||
    !fs.existsSync(keyFile) ||
    Date.now() - fs.statSync(certFile).mtimeMs > 300 * 86400000
  ) {
    const pems = selfsigned.generate(
      [{ name: "commonName", value: "localhost" }],
      {
        days: 365,
        keySize: 2048,
        extensions: [
          {
            name: "subjectAltName",
            altNames: [
              { type: 2, value: "localhost" },
              { type: 7, ip: "127.0.0.1" },
            ],
          },
        ],
      },
    );
    fs.writeFileSync(keyFile, pems.private, { mode: 0o600 });
    fs.writeFileSync(certFile, pems.cert);
  }
  return { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) };
}
