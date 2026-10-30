import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { inside } from "./paths";
import { certificate } from "../server/tls";
import { Launch } from "./types";
import { RuntimeOptions } from "../runtime/launch";
export function config(
  spec: Launch,
  context: vscode.ExtensionContext,
  log: (m: string) => void,
): RuntimeOptions {
  const c = vscode.workspace.getConfiguration(
    "liveServerSpeed",
    vscode.Uri.file(spec.workspace),
  );
  const headers = c.get<Record<string, string>>("headers", {});
  for (const [k, v] of Object.entries(headers))
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(k) || /[\r\n]/.test(v))
      throw new Error("Invalid response header: " + k);
  return {
    injectedFiles: c.get<string[]>("injectedFiles", []).map((file) => {
      const target = path.resolve(spec.workspace, file);
      if (
        !/\.(css|js)$/i.test(target) ||
        !inside(fs.realpathSync(spec.workspace), fs.realpathSync(target))
      )
        throw new Error("Invalid injected CSS/JS file: " + file);
      return target;
    }),
    protectLAN: c.get("protectLAN", true),
    browserConsole: c.get("browserConsole", false),
    apiProxy: c.get("apiProxy", []),
    media: path.join(context.extensionPath, "media"),
    php: c.get("phpPath", "php"),
    packageManager: c.get("packageManager", "npm"),
    spa: c.get("spaFallback", true),
    debounce: c.get("debounceTime", 50),
    polling: c.get("usePolling", false),
    ignored: c.get("ignoredPaths", []),
    extensions: c.get("reloadExtensions", []),
    headers,
    requestLogging: c.get("requestLogging", false),
    nativeHmr: c.get("nativeHmr", true),
    log,
    tls: spec.https
      ? certificate(
          path.join(context.globalStorageUri.fsPath, "certs"),
          c.get("httpsCertPath", ""),
          c.get("httpsKeyPath", ""),
        )
      : undefined,
    readFile: spec.instant
      ? (file: string) =>
          vscode.workspace.textDocuments
            .find((d) => d.uri.fsPath === file && d.isDirty)
            ?.getText()
      : undefined,
  };
}
