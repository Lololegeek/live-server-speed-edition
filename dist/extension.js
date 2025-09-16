"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const server_1 = require("./server");
const open_1 = __importDefault(require("open"));
const chokidar_1 = __importDefault(require("chokidar"));
const path = __importStar(require("path"));
let stopServer = null;
let webviewPanel = null;
let statusButton;
function activate(context) {
    statusButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusButton.text = '$(rocket) Start Fast HTTP';
    statusButton.tooltip = 'Start Fast HTTP Server';
    statusButton.command = 'fast-http-server.toggleServer';
    statusButton.show();
    context.subscriptions.push(statusButton);
    const toggleCmd = vscode.commands.registerCommand('fast-http-server.toggleServer', () => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!stopServer) {
            const folder = (_b = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.uri.fsPath;
            if (!folder) {
                vscode.window.showErrorMessage('No folder is open in VS Code.');
                return;
            }
            const portInput = yield vscode.window.showInputBox({
                prompt: 'Enter the port number for the server',
                value: '5500',
                validateInput: (value) => /^\d+$/.test(value) ? null : 'Please enter a valid port number'
            });
            if (!portInput)
                return;
            const port = parseInt(portInput, 10);
            const files = yield vscode.workspace.findFiles('**/*.html');
            const fileChoices = files.map(f => vscode.workspace.asRelativePath(f));
            const selectedFile = yield vscode.window.showQuickPick(fileChoices, {
                placeHolder: 'Select the HTML file to open'
            });
            if (!selectedFile)
                return;
            const url = `http://localhost:${port}/${selectedFile}`;
            const choice = yield vscode.window.showQuickPick(['Preview without server (Instant)', 'Open in default browser', 'Open in VS Code WebView (Beta)'], { placeHolder: 'How do you want to preview?' });
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
                const previewPanel = vscode.window.createWebviewPanel('instantPreview', 'Instant Preview', vscode.ViewColumn.Two, {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [vscode.Uri.file(documentDir)],
                    enableFindWidget: true
                });
                // Ajouter l'icône
                const iconPath = vscode.Uri.file(path.join(context.extensionPath, 'icon.png'));
                previewPanel.iconPath = iconPath;
                // Fonction pour convertir les chemins relatifs en chemins Webview
                const getWebviewUri = (relativePath) => {
                    const absolutePath = path.join(documentDir, relativePath);
                    return 'vscode-resource:' + absolutePath;
                };
                // Fonction pour mettre à jour le contenu
                const updateContent = (content) => {
                    // Lire et injecter les fichiers CSS directement
                    const cssInjections = new Set();
                    content.replace(/<link[^>]*href=["']([^"']+)\.css["'][^>]*>/g, (match, href) => {
                        if (!href.startsWith('http')) {
                            const cssPath = path.join(documentDir, href + '.css');
                            try {
                                const cssContent = require('fs').readFileSync(cssPath, 'utf8');
                                cssInjections.add(cssContent);
                            }
                            catch (e) {
                                console.error('Failed to load CSS:', e);
                            }
                        }
                        return '';
                    });
                    // Traiter les autres ressources
                    const processedContent = content
                        .replace(/<link[^>]*href=["']([^"']+)\.css["'][^>]*>/g, '' // Supprimer les liens CSS car on les injecte directement
                    )
                        .replace(/<script[^>]*src=["']([^"']+)["'][^>]*>/g, (match, src) => {
                        if (src.startsWith('http'))
                            return match;
                        return match.replace(src, getWebviewUri(src));
                    })
                        .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/g, (match, src) => {
                        if (src.startsWith('http'))
                            return match;
                        return match.replace(src, getWebviewUri(src));
                    });
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
            </body>
            </html>
          `;
                };
                // Mise à jour initiale
                updateContent(document.getText());
                // Écouter les changements
                const changeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
                    if (e.document === document) {
                        updateContent(e.document.getText());
                    }
                });
                // Nettoyage
                previewPanel.onDidDispose(() => {
                    changeDisposable.dispose();
                });
                return;
            }
            stopServer = (0, server_1.startServer)(folder, port, () => __awaiter(this, void 0, void 0, function* () {
                if (choice === 'Open in default browser') {
                    (0, open_1.default)(url);
                }
                else if (choice === 'Open in VS Code WebView (Beta)') {
                    console.log('Creating webview panel...');
                    if (!webviewPanel) {
                        const iconPath = vscode.Uri.file(path.join(context.extensionPath, 'icon.png'));
                        webviewPanel = vscode.window.createWebviewPanel('fastHttpWebview', 'Fast HTTP Server', vscode.ViewColumn.Two, {
                            enableScripts: true,
                            retainContextWhenHidden: true,
                            localResourceRoots: [vscode.Uri.file(folder), vscode.Uri.file(context.extensionPath)]
                        });
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
                    const watcher = chokidar_1.default.watch(folder, {
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
                    context.subscriptions.push({ dispose: () => watcher.close() }, changeTextDisposable);
                }
            }));
            statusButton.text = '$(debug-disconnect) Stop Fast HTTP';
            statusButton.tooltip = 'Stop Fast HTTP Server';
        }
        else {
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
    }));
    context.subscriptions.push(toggleCmd);
}
function getWebviewContent(url, port) {
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
function deactivate() {
    if (stopServer)
        stopServer();
    if (webviewPanel)
        webviewPanel.dispose();
}
