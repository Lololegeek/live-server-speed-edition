import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { inside } from "../core/paths";
export async function selectInjectedFiles(clear = false) {
  const folders = vscode.workspace.workspaceFolders || [];
  const folder =
    folders.length === 1
      ? folders[0]
      : await vscode.window.showWorkspaceFolderPick();
  if (!folder) return;
  const files = clear
    ? []
    : await vscode.window.showOpenDialog({
        canSelectMany: true,
        defaultUri: folder.uri,
        filters: { "CSS / JavaScript": ["css", "js"] },
        openLabel: "Inject into previews",
      });
  if (!files) return;
  const root = fs.realpathSync(folder.uri.fsPath);
  const paths = files.map((file) => {
    if (
      !inside(root, fs.realpathSync(file.fsPath)) ||
      !/\.(css|js)$/i.test(file.fsPath)
    )
      throw new Error("Select CSS/JS files inside this workspace.");
    return path.relative(folder.uri.fsPath, file.fsPath);
  });
  await vscode.workspace
    .getConfiguration("liveServerSpeed", folder.uri)
    .update("injectedFiles", paths, vscode.ConfigurationTarget.WorkspaceFolder);
  vscode.window.showInformationMessage(
    "Preview injection updated. Restart affected sessions.",
  );
}
