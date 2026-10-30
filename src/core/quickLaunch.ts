import * as fs from "fs";
import * as path from "path";
import { Launch } from "./types";
import { inside } from "./paths";
import { detectProject } from "../projectDetector";
export interface QuickSettings {
  root: string;
  entry: string;
  port: number;
  preview: "browser" | "webview";
  liveEditing: boolean;
  upstream: string;
  runtime: "auto" | "static" | "php" | "framework";
}
export function quickLaunch(
  workspace: string,
  file: string | undefined,
  settings: QuickSettings,
  last?: Launch,
): Launch {
  if (last?.workspace === workspace && fs.existsSync(last.root)) {
    const entry =
      file && inside(last.root, file) && /\.(html?|php)$/i.test(file)
        ? path.relative(last.root, file).split(path.sep).join("/")
        : last.entry;
    return { ...last, entry };
  }
  const project = detectProject(workspace);
  const mode =
    settings.runtime === "auto"
      ? file?.endsWith(".php") || project.type === "php"
        ? "php"
        : project.devScript
          ? "framework"
          : "static"
      : settings.runtime;
  const root = path.resolve(
    workspace,
    settings.root ||
      (mode === "php" && fs.existsSync(path.join(workspace, "public/index.php"))
        ? "public"
        : ""),
  );
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory())
    throw new Error("Server root does not exist: " + root);
  let entry = settings.entry;
  if (
    !entry &&
    mode !== "framework" &&
    file &&
    inside(root, file) &&
    /\.(html?|php)$/i.test(file)
  )
    entry = path.relative(root, file).split(path.sep).join("/");
  if (!entry)
    entry = fs.existsSync(
      path.join(root, mode === "php" ? "index.php" : "index.html"),
    )
      ? mode === "php"
        ? "index.php"
        : "index.html"
      : "";
  if (entry && !inside(root, path.resolve(root, entry)))
    throw new Error("Entry file is outside the server root.");
  if (mode === "framework" && !project.devScript)
    throw new Error(
      "No development script found. Use Configure Server to select a script.",
    );
  return {
    workspace,
    root,
    entry,
    mode,
    port: settings.port,
    host: "127.0.0.1",
    https: false,
    preview: settings.preview,
    instant: settings.liveEditing,
    script: project.devScript || undefined,
    upstream: settings.upstream,
  };
}
