import * as vscode from 'vscode';
import { startServer } from './server';
import open from 'open';
import chokidar from 'chokidar';

let stopServer: (() => void) | null = null;
let webviewPanel: vscode.WebviewPanel | null = null;
let statusButton: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  statusButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusButton.text = '$(rocket) Start Fast HTTP';
  statusButton.tooltip = 'Start Fast HTTP Server';
  statusButton.command = 'fast-http-server.toggleServer';
  statusButton.show();
  context.subscriptions.push(statusButton);

  const toggleCmd = vscode.commands.registerCommand('fast-http-server.toggleServer', async () => {
    if (!stopServer) {
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!folder) {
        vscode.window.showErrorMessage('No folder is open in VS Code.');
        return;
      }

      const portInput = await vscode.window.showInputBox({
        prompt: 'Enter the port number for the server',
        value: '5500',
        validateInput: (value) => /^\d+$/.test(value) ? null : 'Please enter a valid port number'
      });

      if (!portInput) return;
      const port = parseInt(portInput, 10);

      const files = await vscode.workspace.findFiles('**/*.html');
      const fileChoices = files.map(f => vscode.workspace.asRelativePath(f));
      const selectedFile = await vscode.window.showQuickPick(fileChoices, {
        placeHolder: 'Select the HTML file to open'
      });

      if (!selectedFile) return;

      const url = `http://localhost:${port}/${selectedFile}`;

      const choice = await vscode.window.showQuickPick(
        ['Open in default browser', 'Open in VS Code WebView (Beta)'],
        { placeHolder: 'How do you want to open the server?' }
      );

      stopServer = startServer(folder, port, async () => {
        if (choice === 'Open in default browser') {
          open(url);
        } else if (choice === 'Open in VS Code WebView (Beta)') {
          console.log('Creating webview panel...');
          if (!webviewPanel) {
            webviewPanel = vscode.window.createWebviewPanel(
              'fastHttpWebview',
              'Fast HTTP Server',
              vscode.ViewColumn.Two,
              { 
                enableScripts: true, 
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.file(folder)]
              }
            );
            webviewPanel.onDidDispose(() => {
              console.log('Webview disposed');
              webviewPanel = null;
            });
          }
          console.log('Setting webview content for URL:', url);
          webviewPanel.webview.html = getWebviewContent(url, port);
          // Mettre à jour la webview quand le fichier change
          // Surveiller les changements de fichiers sur le disque
          const watcher = chokidar.watch(folder, {
            ignoreInitial: true,
            awaitWriteFinish: {
              stabilityThreshold: 2,
              pollInterval: 1
            },
            usePolling: true,
            interval: 100,
            binaryInterval: 100
          });
          
          // Surveiller les changements dans l'éditeur (même non sauvegardés)
          const changeTextDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
            const changedFilePath = event.document.uri.fsPath;
            if (changedFilePath.startsWith(folder) && 
               (changedFilePath.endsWith('.html') || 
                changedFilePath.endsWith('.css') || 
                changedFilePath.endsWith('.js'))) {
              if (webviewPanel) {
                webviewPanel.webview.html = getWebviewContent(url, port);
              }
            }
          });

          watcher.on('all', () => {
            if (webviewPanel) {
              webviewPanel.webview.html = getWebviewContent(url, port);
            }
          });

          // Nettoyage des écouteurs d'événements
          context.subscriptions.push(
            { dispose: () => watcher.close() },
            changeTextDisposable
          );
        }
      });

      statusButton.text = '$(debug-disconnect) Stop Fast HTTP';
      statusButton.tooltip = 'Stop Fast HTTP Server';
    } else {
      stopServer();
      stopServer = null;
      if (webviewPanel) {
        webviewPanel.dispose();
        webviewPanel = null;
      }
      vscode.window.showInformationMessage('Server stopped.');
      statusButton.text = '$(rocket) Start Fast HTTP';
      statusButton.tooltip = 'Start Fast HTTP Server';
    }
  });

  context.subscriptions.push(toggleCmd);
}

function getWebviewContent(url: string, port: number): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          overflow: hidden;
          background-color: #1e1e1e;
        }
        iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
        #loading {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #ccc;
          font-family: sans-serif;
        }
      </style>
    </head>
    <body>
      <div id="loading">Chargement du preview...</div>
      <iframe id="previewFrame" 
              src="${url}" 
              onload="document.getElementById('loading').style.display='none';"
              onerror="console.error('Failed to load iframe:', event)">
      </iframe>
      <script>
        console.log('Connecting to WebSocket server...');
        const ws = new WebSocket('ws://localhost:${port}');
        const frame = document.getElementById('previewFrame');
        
        // Optimisation du rechargement
        let lastReloadTime = 0;
        ws.onmessage = () => {
          const now = Date.now();
          // Éviter les rechargements trop fréquents (min 100ms entre chaque)
          if (now - lastReloadTime < 100) return;
          lastReloadTime = now;
          
          console.log('🔄 Reload triggered');
          // Utilise la méthode contentWindow.location.reload(true) pour un rechargement forcé
          try {
            frame.contentWindow.location.reload(true);
          } catch(e) {
            frame.src = '${url}?' + now; // Ajoute un timestamp pour forcer le rechargement
          }
        };

        window.addEventListener('resize', () => {
          const frame = document.getElementById('previewFrame');
          frame.style.height = window.innerHeight + 'px';
        });
      </script>
    </body>
    </html>
  `;
}

export function deactivate() {
  if (stopServer) stopServer();
  if (webviewPanel) webviewPanel.dispose();
}
