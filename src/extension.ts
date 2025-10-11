import * as vscode from 'vscode';
import { startServer } from './server';
import open from 'open';
import chokidar from 'chokidar';
import * as path from 'path';
import * as net from 'net';

let stopServer: (() => void) | null = null;
let webviewPanel: vscode.WebviewPanel | null = null;
let statusButton: vscode.StatusBarItem;

// Function to check if port is available
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, '127.0.0.1', () => {
      server.close();
      resolve(true);
    });
    server.on('error', () => {
      resolve(false);
    });
  });
}


console.log("the extension is good")

export function activate(context: vscode.ExtensionContext) {
  statusButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusButton.text = '$(rocket) Start Fast HTTP';
  statusButton.tooltip = 'Start Fast HTTP Server';
  statusButton.command = 'fast-http-server.toggleServer';
  statusButton.show();
  context.subscriptions.push(statusButton);

  // Create Instant Preview button in editor title area
  const instantPreviewButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  instantPreviewButton.text = '$(eye) Instant Preview';
  instantPreviewButton.tooltip = 'Show Instant Preview of current HTML file';
  instantPreviewButton.command = 'fast-http-server.instantPreview';
  instantPreviewButton.show();
  context.subscriptions.push(instantPreviewButton);

  // Register Instant Preview command
  const instantPreviewCmd = vscode.commands.registerCommand('fast-http-server.instantPreview', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return;
    }

    if (editor.document.languageId !== 'html') {
      vscode.window.showErrorMessage('Please open an HTML file for instant preview');
      return;
    }

    const document = editor.document;
    const docUri = document.uri;
    const documentDir = path.dirname(docUri.fsPath);

    // Créer une webview pour la prévisualisation instantanée
    const previewPanel = vscode.window.createWebviewPanel(
      'instantPreview',
      'Instant Preview',
      vscode.ViewColumn.Two,
      { 
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(documentDir)],
        enableFindWidget: true
      }
    );

    // Ajouter l'icône
    const iconPath = vscode.Uri.file(path.join(context.extensionPath, 'icon.png'));
    previewPanel.iconPath = iconPath;

    // Fonction pour convertir les chemins relatifs en chemins Webview
    const getWebviewUri = (relativePath: string) => {
      const absolutePath = path.join(documentDir, relativePath);
      return 'vscode-resource:' + absolutePath;
    };

    // Fonction pour mettre à jour le contenu
    const updateContent = (content: string) => {
      // Lire et injecter les fichiers CSS directement
      const cssInjections = new Set<string>();
      content.replace(
        /<link[^>]*href=["']([^"']+)\.css["'][^>]*>/g,
        (match, href) => {
          if (!href.startsWith('http')) {
            const cssPath = path.join(documentDir, href.endsWith('.css') ? href : href + '.css');
            try {
              const cssContent = require('fs').readFileSync(cssPath, 'utf8');
              cssInjections.add(cssContent);
            } catch (e) {
              console.error('Failed to load CSS:', e);
            }
          }
          return '';
        }
      );

      // Lire et injecter les scripts JS directement
      const scriptInjections = new Set<string>();
      content = content.replace(
        /<script[^>]*src=["']([^"']+)\.js["'][^>]*><\/script>/g,
        (match, src) => {
          if (!src.startsWith('http')) {
            const jsPath = path.join(documentDir, src.endsWith('.js') ? src : src + '.js');
            try {
              const jsContent = require('fs').readFileSync(jsPath, 'utf8');
              scriptInjections.add(jsContent);
            } catch (e) {
              console.error('Failed to load JS:', e);
            }
            return ''; // Remove the script tag, will inject inline
          }
          return match;
        }
      );

      // Traiter les autres ressources
      const processedContent = content
        .replace(
          /<link[^>]*href=["']([^"']+)\.css["'][^>]*>/g,
          '' // Supprimer les liens CSS car on les injecte directement
        )
        .replace(
          /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/g,
          (match, src) => {
            if (src.startsWith('http')) return match;
            return ''; // Already handled above
          }
        )
        .replace(
          /<img[^>]*src=["']([^"']+)["'][^>]*>/g,
          (match, src) => {
            if (src.startsWith('http')) return match;
            return match.replace(src, getWebviewUri(src));
          }
        );

      previewPanel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; padding: 20px; }
          </style>
          ${[...cssInjections].map(css => `<style>${css}</style>`).join('\n')}
        </head>
        <body>
          ${processedContent}
          ${[...scriptInjections].map(js => `<script>${js}</script>`).join('\n')}
        </body>
        </html>
      `;
    };

    // Debounce function for instant preview updates - reduced for faster response
    let updateTimeout: NodeJS.Timeout | null = null;
    const debounceUpdate = (content: string) => {
      if (updateTimeout) clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        updateContent(content);
      }, 50); // Reduced to 50ms for more instant updates
    };

    // Mise à jour initiale
    updateContent(document.getText());

    // Écouter les changements
    const changeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document === document) {
        debounceUpdate(e.document.getText());
      }
    });

    // Nettoyage
    previewPanel.onDidDispose(() => {
      changeDisposable.dispose();
    });
  });
  context.subscriptions.push(instantPreviewCmd);

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

      // Check if port is available
      const available = await isPortAvailable(port);
      if (!available) {
        const tryAgain = await vscode.window.showErrorMessage(
          `Port ${port} is already in use. Choose another port?`,
          'Try Another Port',
          'Cancel'
        );
        if (tryAgain === 'Try Another Port') {
          // Recursively call the command or loop, but for simplicity, just return
          return;
        } else {
          return;
        }
      }

      const files = await vscode.workspace.findFiles('**/*.html');
      const fileChoices = files.map(f => vscode.workspace.asRelativePath(f));
      const selectedFile = await vscode.window.showQuickPick(fileChoices, {
        placeHolder: 'Select the HTML file to open'
      });

      if (!selectedFile) return;

      const url = `http://localhost:${port}/${selectedFile}`;

      const choice = await vscode.window.showQuickPick(
        ['Preview without server (Instant)', 'Open in default browser', 'Open in VS Code WebView (Beta)'],
        { placeHolder: 'How do you want to preview?' }
      );

      if (choice === 'Preview without server (Instant)') {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage('No active editor');
          return;
        }

        const document = editor.document;
        const docUri = document.uri;
        const documentDir = path.dirname(docUri.fsPath);

        // Créer une webview pour la prévisualisation instantanée
        const previewPanel = vscode.window.createWebviewPanel(
          'instantPreview',
          'Instant Preview',
          vscode.ViewColumn.Two,
          { 
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.file(documentDir)],
            enableFindWidget: true
          }
        );

        // Ajouter l'icône
        const iconPath = vscode.Uri.file(path.join(context.extensionPath, 'icon.png'));
        previewPanel.iconPath = iconPath;

        // Fonction pour convertir les chemins relatifs en chemins Webview
        const getWebviewUri = (relativePath: string) => {
          const absolutePath = path.join(documentDir, relativePath);
          return 'vscode-resource:' + absolutePath;
        };

        // Fonction pour mettre à jour le contenu
        const updateContent = (content: string) => {
          // Lire et injecter les fichiers CSS directement
          const cssInjections = new Set<string>();
          content.replace(
            /<link[^>]*href=["']([^"']+)\.css["'][^>]*>/g,
            (match, href) => {
              if (!href.startsWith('http')) {
                const cssPath = path.join(documentDir, href.endsWith('.css') ? href : href + '.css');
                try {
                  const cssContent = require('fs').readFileSync(cssPath, 'utf8');
                  cssInjections.add(cssContent);
                } catch (e) {
                  console.error('Failed to load CSS:', e);
                }
              }
              return '';
            }
          );

          // Lire et injecter les scripts JS directement
          const scriptInjections = new Set<string>();
          content = content.replace(
            /<script[^>]*src=["']([^"']+)\.js["'][^>]*><\/script>/g,
            (match, src) => {
              if (!src.startsWith('http')) {
                const jsPath = path.join(documentDir, src.endsWith('.js') ? src : src + '.js');
                try {
                  const jsContent = require('fs').readFileSync(jsPath, 'utf8');
                  scriptInjections.add(jsContent);
                } catch (e) {
                  console.error('Failed to load JS:', e);
                }
                return ''; // Remove the script tag, will inject inline
              }
              return match;
            }
          );

          // Traiter les autres ressources
          const processedContent = content
            .replace(
              /<link[^>]*href=["']([^"']+)\.css["'][^>]*>/g,
              '' // Supprimer les liens CSS car on les injecte directement
            )
            .replace(
              /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/g,
              (match, src) => {
                if (src.startsWith('http')) return match;
                return ''; // Already handled above
              }
            )
            .replace(
              /<img[^>]*src=["']([^"']+)["'][^>]*>/g,
              (match, src) => {
                if (src.startsWith('http')) return match;
                return match.replace(src, getWebviewUri(src));
              }
            );

          previewPanel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { margin: 0; padding: 20px; }
              </style>
              ${[...cssInjections].map(css => `<style>${css}</style>`).join('\n')}
            </head>
            <body>
              ${processedContent}
              ${[...scriptInjections].map(js => `<script>${js}</script>`).join('\n')}
            </body>
            </html>
          `;
        };

        // Debounce function for instant preview updates
        let updateTimeout: NodeJS.Timeout | null = null;
        const debounceUpdate = (content: string) => {
          if (updateTimeout) clearTimeout(updateTimeout);
          updateTimeout = setTimeout(() => {
            updateContent(content);
          }, 200); // Debounce to 200ms for instant preview
        };

        // Mise à jour initiale
        updateContent(document.getText());

        // Écouter les changements
        const changeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
          if (e.document === document) {
            debounceUpdate(e.document.getText());
          }
        });

        // Nettoyage
        previewPanel.onDidDispose(() => {
          changeDisposable.dispose();
        });

        return;
      }

      stopServer = startServer(folder, port, async () => {
        if (choice === 'Open in default browser') {
          open(url);
        } else if (choice === 'Open in VS Code WebView (Beta)') {
          console.log('Creating webview panel...');
          if (!webviewPanel) {
            const iconPath = vscode.Uri.file(path.join(context.extensionPath, 'icon.png'));
            webviewPanel = vscode.window.createWebviewPanel(
              'fastHttpWebview',
              'Fast HTTP Server',
              vscode.ViewColumn.Two,
              { 
                enableScripts: true, 
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.file(folder), vscode.Uri.file(context.extensionPath)]
              }
            );
            webviewPanel.iconPath = iconPath;
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
