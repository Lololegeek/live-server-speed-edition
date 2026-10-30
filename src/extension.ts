import * as vscode from "vscode";
import * as path from "path";
import { Controller } from "./core/controller";
import { quickStart } from "./commands/quickStart";
import { setup } from "./commands/setup";
import { detectProject } from "./projectDetector";
import { Launch } from "./core/types";
let controller: Controller | undefined;
export function activate(context: vscode.ExtensionContext) {
  const app = new Controller(context);
  controller = app;
  context.subscriptions.push(app);
  const command = (id: string, fn: (uri?: vscode.Uri) => unknown) =>
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "fast-http-server." + id,
        async (uri?: vscode.Uri) => {
          try {
            await fn(uri);
          } catch (error) {
            vscode.window.showErrorMessage(String(error));
          }
        },
      ),
    );
  command("toggleServer", async () => {
    if (app.active || app.starting) await app.stop();
    else {
      const spec =
        vscode.workspace
          .getConfiguration("liveServerSpeed")
          .get<string>("interfaceMode", "full") === "lite"
          ? await quickStart(app.last)
          : await setup(undefined, app.last);
      if (spec) await app.start(spec);
    }
  });
  command("configureServer", async () => {
    const spec = await setup(undefined, app.last);
    if (spec) await app.start(spec);
  });
  command("quickStart", async () => {
    const spec = await quickStart(app.last);
    if (spec) await app.start(spec);
  });
  command("openHtmlWithNewParams", async (uri) => {
    const spec = await setup(uri, app.last);
    if (spec) await app.start(spec);
  });
  command("relaunchLast", async () => {
    const spec = app.last || (await setup());
    if (spec) await app.start(spec);
  });
  command("restartServer", async () => {
    const spec = app.last || (await setup());
    if (spec) await app.start(spec);
  });
  command("openHtmlWithLastParams", async (uri) => {
    const last = app.last;
    if (!last) {
      const spec = await setup(uri);
      if (spec) await app.start(spec);
      return;
    }
    if (!uri) return;
    const workspace = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspace || workspace.uri.fsPath !== last.workspace)
      throw new Error("Choose parameters for this workspace first.");
    const rel = path.relative(last.root, uri.fsPath);
    if (rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel))
      throw new Error("File is outside the served root.");
    await app.start({ ...last, entry: rel.split(path.sep).join("/") });
  });
  command("instantPreview", async () => {
    const doc = vscode.window.activeTextEditor?.document;
    if (!doc || doc.languageId !== "html")
      throw new Error("Open an HTML document first.");
    const workspace = vscode.workspace.getWorkspaceFolder(doc.uri);
    if (!workspace) throw new Error("Open the HTML file in a workspace.");
    const spec: Launch = {
      workspace: workspace.uri.fsPath,
      root: workspace.uri.fsPath,
      entry: path
        .relative(workspace.uri.fsPath, doc.uri.fsPath)
        .split(path.sep)
        .join("/"),
      mode: "static",
      port: 0,
      host: "127.0.0.1",
      https: false,
      preview: "webview",
      instant: true,
    };
    await app.start(spec);
  });
  command("reopenWebview", () => app.reopen());
  command("showQr", () => app.showQr());
  command("copyUrl", () => app.copy());
  command("stopServer", () => app.stop());
  command("showLogs", () => app.output.show(true));
  command("openSettings", () =>
    vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "@ext:Lololegeek.live-server-speed-edition",
    ),
  );
  const shortcuts = () =>
    vscode.commands.executeCommand(
      "workbench.action.openGlobalKeybindings",
      "@ext:Lololegeek.live-server-speed-edition",
    );
  command("setShortcut", shortcuts);
  command("openKeybindings", shortcuts);
  command("detectProject", () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (folder) {
      app.log(JSON.stringify(detectProject(folder.uri.fsPath), null, 2));
      app.output.show(true);
    }
  });
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("liveServerSpeed")) app.render();
    }),
    vscode.workspace.onDidSaveTextDocument((d) => app.changed(d.uri.fsPath)),
    vscode.workspace.onDidChangeTextDocument((e) =>
      app.changed(e.document.uri.fsPath, e.document.getText()),
    ),
  );
}
export async function deactivate() {
  await controller?.stop();
}
