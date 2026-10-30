import * as vscode from "vscode";
import { Launch } from "../core/types";
import { quickLaunch } from "../core/quickLaunch";
export async function quickStart(last?: Launch): Promise<Launch | undefined> {
  const file = vscode.window.activeTextEditor?.document.uri;
  const folders = vscode.workspace.workspaceFolders || [];
  const folder =
    (file && vscode.workspace.getWorkspaceFolder(file)) ||
    (folders.length === 1
      ? folders[0]
      : await vscode.window.showWorkspaceFolderPick());
  if (!folder) return;
  const c = vscode.workspace.getConfiguration("liveServerSpeed", folder.uri);
  return quickLaunch(
    folder.uri.fsPath,
    file?.fsPath,
    {
      root: c.get("serverRoot", ""),
      entry: c.get("entryFile", ""),
      port: c.get("port", 5500),
      preview: c.get("defaultPreview", "browser"),
      liveEditing: c.get("liveEditing", true),
      upstream: c.get("upstreamUrl", "http://127.0.0.1:5173"),
      runtime: c.get("liteRuntime", "auto"),
    },
    last,
  );
}
