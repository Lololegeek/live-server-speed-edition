import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { Launch, Mode } from "../core/types";
import { inside } from "../core/paths";
import { localTarget } from "../core/network";
import { detectProject } from "../projectDetector";
export async function setup(
  clicked?: vscode.Uri,
  last?: Launch,
): Promise<Launch | undefined> {
  const workspace = clicked
    ? vscode.workspace.getWorkspaceFolder(clicked)
    : vscode.workspace.getWorkspaceFolder(
        vscode.window.activeTextEditor?.document.uri || vscode.Uri.file(""),
      );
  const folders = vscode.workspace.workspaceFolders || [];
  const chosen =
    workspace ||
    (folders.length === 1
      ? folders[0]
      : await vscode.window.showWorkspaceFolderPick());
  if (!chosen) return;
  const folder = chosen.uri.fsPath,
    c = vscode.workspace.getConfiguration("liveServerSpeed", chosen.uri);
  const project = detectProject(folder);
  const modePick = await vscode.window.showQuickPick(
    [
      { label: "Static HTML / CSS / JavaScript", id: "static" },
      { label: "PHP + live reload", id: "php" },
      { label: "Framework dev server (JS / TS)", id: "framework" },
      { label: "Attach existing localhost server", id: "external" },
    ],
    { placeHolder: project.description },
  );
  if (!modePick) return;
  const mode = modePick.id as Mode;
  let root = path.resolve(
    folder,
    c.get<string>("serverRoot", "") ||
      (mode === "static" && c.get("frameworkMode", "auto") === "auto"
        ? project.buildDirectory || ""
        : ""),
  );
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory())
    throw new Error("Server root is not a directory: " + root);
  let entry = c.get<string>("entryFile", "") || "";
  if (clicked) {
    if (!inside(root, clicked.fsPath))
      throw new Error(
        "Selected file is outside the served root. Change serverRoot or select the build entry.",
      );
    entry = path.relative(root, clicked.fsPath).split(path.sep).join("/");
  }
  if (!entry)
    entry =
      mode === "php" && fs.existsSync(path.join(root, "index.php"))
        ? "index.php"
        : fs.existsSync(path.join(root, "index.html"))
          ? "index.html"
          : "";
  const portInput = await vscode.window.showInputBox({
    prompt: "Server port",
    value: String(last?.port || c.get("port", 5500)),
    validateInput: (v) =>
      /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 65535
        ? undefined
        : "Use a port from 1 to 65535",
  });
  if (!portInput) return;
  const hostPick = await vscode.window.showQuickPick(
    [
      { label: "Localhost only", host: "127.0.0.1" },
      { label: "Local network (phone / QR)", host: "0.0.0.0" },
    ],
    { placeHolder: "Who can access this preview?" },
  );
  if (!hostPick) return;
  const protocol = await vscode.window.showQuickPick(["HTTP", "HTTPS"], {
    placeHolder:
      "HTTPS uses your certificate, or a locally generated self-signed certificate",
  });
  if (!protocol) return;
  const preview = await vscode.window.showQuickPick([
    { label: "Browser", id: "browser" },
    { label: "VS Code WebView", id: "webview" },
  ]);
  if (!preview) return;
  let script: string | undefined, upstream: string | undefined;
  if (mode === "framework" || mode === "external") {
    if (mode === "framework") {
      script = await vscode.window.showInputBox({
        prompt: "Existing package.json script to run",
        value: project.devScript || "dev",
        validateInput: (v) =>
          /^[a-zA-Z0-9:_-]+$/.test(v) ? undefined : "Use a package script name",
      });
      if (!script) return;
      const pkg = JSON.parse(
        fs.readFileSync(path.join(folder, "package.json"), "utf8"),
      );
      if (typeof pkg.scripts?.[script] !== "string")
        throw new Error("Script not found in package.json: " + script);
    }
    upstream = await vscode.window.showInputBox({
      prompt:
        "Local development server URL (configure its port in your project script)",
      value: last?.upstream || c.get("upstreamUrl", "http://127.0.0.1:5173"),
      validateInput: (v) => {
        try {
          localTarget(v);
          return undefined;
        } catch (e) {
          return String(e);
        }
      },
    });
    if (!upstream) return;
  }
  return {
    workspace: folder,
    root,
    entry,
    mode,
    port: Number(portInput),
    host: hostPick.host,
    https: protocol === "HTTPS",
    preview: preview.id as Launch["preview"],
    script,
    upstream,
    instant: mode !== "external" && c.get("liveEditing", true),
  };
}
