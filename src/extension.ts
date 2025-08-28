import * as vscode from 'vscode';
import { startServer } from './server';
import open from 'open';

let stopServer: (() => void) | null = null;
let webviewPanel: vscode.WebviewPanel | null = null;
let statusButton: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  // Crée le bouton unique
  statusButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusButton.text = '$(rocket) Start Fast HTTP';
  statusButton.tooltip = 'Start Fast HTTP Server';
  statusButton.command = 'fast-http-server.toggleServer';
  statusButton.show();
  context.subscriptions.push(statusButton);

  // Commande toggle
  const toggleCmd = vscode.commands.registerCommand('fast-http-server.toggleServer', async () => {
    if (!stopServer) {
      // Serveur éteint → démarrer
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!folder) {
        vscode.window.showErrorMessage('No folder is open in VS Code.');
        return;
      }

      const port = 5500;
      const choice = await vscode.window.showQuickPick(
        ['Open in default browser', 'Open in VS Code WebView'],
        { placeHolder: 'How do you want to open the server?' }
      );

      stopServer = startServer(folder, port, async (url) => {
        if (choice === 'Open in default browser') {
          open(url);
        } else if (choice === 'Open in VS Code WebView') {
          if (webviewPanel) {
            webviewPanel.reveal(vscode.ViewColumn.Two);
          } else {
            webviewPanel = vscode.window.createWebviewPanel(
              'fastHttpWebview',
              'Fast HTTP Server',
              vscode.ViewColumn.Two,
              { enableScripts: true }
            );
            webviewPanel.webview.html = `<iframe src="${url}" style="width:100%;height:100%;border:none;"></iframe>`;
            webviewPanel.onDidDispose(() => (webviewPanel = null));
          }
        }
      });

      // Met à jour le bouton
      statusButton.text = '$(debug-disconnect) Stop Fast HTTP';
      statusButton.tooltip = 'Stop Fast HTTP Server';
    } else {
      // Serveur allumé → arrêter
      stopServer();
      stopServer = null;
      if (webviewPanel) {
        webviewPanel.dispose();
        webviewPanel = null;
      }
      vscode.window.showInformationMessage('Server stopped.');
      // Met à jour le bouton
      statusButton.text = '$(rocket) Start Fast HTTP';
      statusButton.tooltip = 'Start Fast HTTP Server';
    }
  });

  context.subscriptions.push(toggleCmd);
}

export function deactivate() {
  if (stopServer) stopServer();
  if (webviewPanel) webviewPanel.dispose();
}
