import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { Launch, Mode } from "../core/types";
import { inside } from "../core/paths";
import { localTarget } from "../core/network";
import { detectProject } from "../projectDetector";
import { input, pick, Back } from "./wizard";
import { wizardText as w } from "../ui/wizardText";
export async function setup(
  clicked?: vscode.Uri,
  last?: Launch,
): Promise<Launch | undefined> {
  const folders = vscode.workspace.workspaceFolders || [];
  const chosen =
    (clicked && vscode.workspace.getWorkspaceFolder(clicked)) ||
    (vscode.window.activeTextEditor &&
      vscode.workspace.getWorkspaceFolder(
        vscode.window.activeTextEditor.document.uri,
      )) ||
    (folders.length === 1
      ? folders[0]
      : await vscode.window.showWorkspaceFolderPick());
  if (!chosen) return;
  const c = vscode.workspace.getConfiguration("liveServerSpeed", chosen.uri);
  let directory = ".",
    modeIndex = 0,
    port = String(last?.port || c.get("port", 5500)),
    hostIndex = 0,
    protocol = 0,
    preview = c.get<string>("defaultPreview", "browser") === "webview" ? 1 : 0,
    script = "dev",
    upstream = last?.upstream || c.get("upstreamUrl", "http://127.0.0.1:5173");
  let folder = chosen.uri.fsPath;
  const validateFolder = (value: string) => {
    const target = path.resolve(chosen.uri.fsPath, value);
    try {
      return inside(
        fs.realpathSync(chosen.uri.fsPath),
        fs.realpathSync(target),
      ) && fs.statSync(target).isDirectory()
        ? undefined
        : w(16);
    } catch {
      return w(16);
    }
  };
  let step = 0;
  while (step < 8) {
    let answer: string | number | typeof Back | undefined;
    if (step === 0) {
      answer = await input(w(0), directory, validateFolder);
      if (typeof answer === "string") {
        directory = answer;
        folder = path.resolve(chosen.uri.fsPath, directory);
        script = detectProject(folder).devScript || "dev";
      }
    }
    if (step === 1) {
      answer = await pick(w(17), [w(1), w(2), w(3), w(4)], modeIndex);
      if (typeof answer === "number") modeIndex = answer;
    }
    if (step === 2) {
      answer = await input(w(5), port, (v) =>
        /^\d+$/.test(v) && +v > 0 && +v <= 65535 ? undefined : w(6),
      );
      if (typeof answer === "string") port = answer;
    }
    if (step === 3) {
      answer = await pick(w(9), [w(7), w(8)], hostIndex);
      if (typeof answer === "number") hostIndex = answer;
    }
    if (step === 4) {
      answer = await pick(w(10), ["HTTP", "HTTPS"], protocol);
      if (typeof answer === "number") protocol = answer;
    }
    if (step === 5) {
      answer = await pick(w(18), [w(11), w(12)], preview);
      if (typeof answer === "number") preview = answer;
    }
    if (step === 6) {
      if (modeIndex !== 2) {
        step++;
        continue;
      }
      answer = await input(w(13), script, (v) => {
        try {
          return /^[a-zA-Z0-9:_-]+$/.test(v) &&
            typeof JSON.parse(
              fs.readFileSync(path.join(folder, "package.json"), "utf8"),
            ).scripts?.[v] === "string"
            ? undefined
            : w(14);
        } catch {
          return w(14);
        }
      });
      if (typeof answer === "string") script = answer;
    }
    if (step === 7) {
      if (modeIndex < 2) break;
      answer = await input(w(15), upstream, (v) => {
        try {
          localTarget(v);
          return undefined;
        } catch (e) {
          return String(e);
        }
      });
      if (typeof answer === "string") upstream = answer;
    }
    if (answer === Back) {
      if (step === 0) return;
      step--;
      if (step === 6 && modeIndex !== 2) step = 5;
      continue;
    }
    if (answer === undefined) return;
    step++;
  }
  const mode = ["static", "php", "framework", "external"][modeIndex] as Mode;
  const project = detectProject(folder);
  const root = path.resolve(
    folder,
    c.get<string>("serverRoot", "") ||
      (mode === "static" && c.get("frameworkMode", "auto") === "auto"
        ? project.buildDirectory || ""
        : ""),
  );
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory())
    throw new Error(w(16));
  if (clicked && !inside(root, clicked.fsPath)) throw new Error(w(16));
  const entry = clicked
    ? path.relative(root, clicked.fsPath).split(path.sep).join("/")
    : c.get<string>("entryFile", "") ||
      (mode === "php" && fs.existsSync(path.join(root, "index.php"))
        ? "index.php"
        : fs.existsSync(path.join(root, "index.html"))
          ? "index.html"
          : "");
  return {
    workspace: folder,
    root,
    entry,
    mode,
    port: +port,
    host: hostIndex ? "0.0.0.0" : "127.0.0.1",
    https: protocol === 1,
    preview: preview ? "webview" : "browser",
    script,
    upstream,
    instant: mode !== "external" && c.get("liveEditing", true),
  };
}
