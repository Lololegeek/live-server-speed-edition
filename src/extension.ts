import * as vscode from 'vscode';
import { startServer } from './server';
import open from 'open';
import chokidar from 'chokidar';
import * as path from 'path';
import * as net from 'net';

let stopServer: (() => void) | null = null;
let webviewPanel: vscode.WebviewPanel | null = null;
let statusButton: vscode.StatusBarItem;
let currentWebviewUrl: string | null = null;
let currentWebviewPort: number | null = null;

const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    start: '$(rocket) Start Fast HTTP',
    stop: '$(debug-disconnect) Stop Fast HTTP',
    startTooltip: 'Start Fast HTTP Server',
    stopTooltip: 'Stop Fast HTTP Server',
    instantPreview: '$(eye) Instant Preview',
    instantPreviewTooltip: 'Show Instant Preview of current HTML file',
    noFolder: 'No folder is open in VS Code.',
    noEditor: 'No active editor',
    openHtml: 'Please open an HTML file for instant preview',
    loading: 'Loading preview...'
    ,
    enterPort: 'Enter the port number for the server',
    invalidPort: 'Please enter a valid port number',
    selectHtml: 'Select the HTML file to open',
    previewInstant: 'Preview without server (Instant)',
    openDefault: 'Open in default browser',
    openWebview: 'Open in VS Code WebView (Beta)',
    howPreview: 'How do you want to preview?',
    tryAnotherPort: 'Try Another Port',
    cancel: 'Cancel',
    portInUse: 'Port {port} is already in use. Choose another port?',
    instantPreviewTitle: 'Instant Preview',
    fastHttpServerTitle: 'Fast HTTP Server',
    serverStopped: 'Server stopped.'
  },
  fr: {
    start: '$(rocket) Démarrer Fast HTTP',
    stop: '$(debug-disconnect) Arrêter Fast HTTP',
    startTooltip: "Démarrer le serveur Fast HTTP",
    stopTooltip: "Arrêter le serveur Fast HTTP",
    instantPreview: '$(eye) Prévisualisation instantanée',
    instantPreviewTooltip: "Afficher la prévisualisation du fichier HTML courant",
    noFolder: "Aucun dossier n'est ouvert dans VS Code.",
    noEditor: "Aucun éditeur actif",
    openHtml: "Veuillez ouvrir un fichier HTML pour la prévisualisation instantanée",
    loading: 'Chargement du preview...'
    ,
    enterPort: "Entrez le numéro de port pour le serveur",
    invalidPort: "Veuillez entrer un numéro de port valide",
    selectHtml: "Sélectionnez le fichier HTML à ouvrir",
    previewInstant: "Prévisualiser sans serveur (Instant)",
    openDefault: "Ouvrir dans le navigateur par défaut",
    openWebview: "Ouvrir dans WebView VS Code (Beta)",
    howPreview: "Comment voulez-vous prévisualiser ?",
    tryAnotherPort: "Essayer un autre port",
    cancel: "Annuler",
    portInUse: "Le port {port} est déjà utilisé. Choisissez un autre port ?",
    instantPreviewTitle: "Prévisualisation instantanée",
    fastHttpServerTitle: "Serveur Fast HTTP",
    serverStopped: "Serveur arrêté."
  },
  es: {
    start: '$(rocket) Iniciar Fast HTTP',
    stop: '$(debug-disconnect) Detener Fast HTTP',
    startTooltip: 'Iniciar servidor Fast HTTP',
    stopTooltip: 'Detener servidor Fast HTTP',
    instantPreview: '$(eye) Vista instantánea',
    instantPreviewTooltip: 'Mostrar vista previa del archivo HTML actual',
    noFolder: 'No hay ninguna carpeta abierta en VS Code.',
    noEditor: 'Ningún editor activo',
    openHtml: 'Abre un archivo HTML para la vista instantánea',
    loading: 'Cargando vista previa...'
    ,
    enterPort: 'Introduce el número de puerto para el servidor',
    invalidPort: 'Por favor introduce un número de puerto válido',
    selectHtml: 'Selecciona el archivo HTML a abrir',
    previewInstant: 'Vista previa sin servidor (Instantánea)',
    openDefault: 'Abrir en el navegador por defecto',
    openWebview: 'Abrir en WebView de VS Code (Beta)',
    howPreview: '¿Cómo quieres previsualizar?',
    tryAnotherPort: 'Probar otro puerto',
    cancel: 'Cancelar',
    portInUse: 'El puerto {port} ya está en uso. ¿Elegir otro puerto?',
    instantPreviewTitle: 'Vista instantánea',
    fastHttpServerTitle: 'Fast HTTP Server',
    serverStopped: 'Servidor detenido.'
  },
  de: {
    start: '$(rocket) Fast HTTP starten',
    stop: '$(debug-disconnect) Fast HTTP stoppen',
    startTooltip: 'Fast HTTP Server starten',
    stopTooltip: 'Fast HTTP Server stoppen',
    instantPreview: '$(eye) Sofortvorschau',
    instantPreviewTooltip: 'Sofortvorschau der aktuellen HTML-Datei anzeigen',
    noFolder: 'Kein Ordner in VS Code geöffnet.',
    noEditor: 'Kein aktiver Editor',
    openHtml: 'Bitte öffne eine HTML-Datei für die Sofortvorschau',
    loading: 'Vorschau wird geladen...'
    ,
    enterPort: 'Gib die Portnummer für den Server ein',
    invalidPort: 'Bitte gib eine gültige Portnummer ein',
    selectHtml: 'Wähle die zu öffnende HTML-Datei aus',
    previewInstant: 'Vorschau ohne Server (Sofort)',
    openDefault: 'Im Standardbrowser öffnen',
    openWebview: 'In VS Code WebView öffnen (Beta)',
    howPreview: 'Wie möchtest du die Vorschau anzeigen?',
    tryAnotherPort: 'Anderen Port versuchen',
    cancel: 'Abbrechen',
    portInUse: 'Port {port} ist bereits in Verwendung. Wähle einen anderen Port?',
    instantPreviewTitle: 'Sofortvorschau',
    fastHttpServerTitle: 'Fast HTTP Server',
    serverStopped: 'Server gestoppt.'
  }
};

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
  const instantPreviewButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);

  function getTranslation(key: string, fallback: string): string {
    const lang = vscode.workspace.getConfiguration().get<string>('liveServerSpeed.language', 'en') || 'en';
    const tr = TRANSLATIONS[lang] || TRANSLATIONS.en;
    return tr[key] || fallback;
  }

  function getDebounceTime(): number {
    return vscode.workspace.getConfiguration().get<number>('liveServerSpeed.debounceTime', 200) || 200;
  }

  const applyTranslations = () => {
    statusButton.text = getTranslation('start', '$(rocket) Start Fast HTTP');
    statusButton.tooltip = getTranslation('startTooltip', 'Start Fast HTTP Server');
    instantPreviewButton.text = getTranslation('instantPreview', '$(eye) Instant Preview');
    instantPreviewButton.tooltip = getTranslation('instantPreviewTooltip', 'Show Instant Preview of current HTML file');
  };

  applyTranslations();

  statusButton.command = 'fast-http-server.toggleServer';
  statusButton.show();
  context.subscriptions.push(statusButton);

  instantPreviewButton.command = 'fast-http-server.instantPreview';
  instantPreviewButton.show();
  context.subscriptions.push(instantPreviewButton);

  const instantPreviewCmd = vscode.commands.registerCommand('fast-http-server.instantPreview', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(getTranslation('noEditor', 'No active editor'));
      return;
    }

    if (editor.document.languageId !== 'html') {
      vscode.window.showErrorMessage(getTranslation('openHtml', 'Please open an HTML file for instant preview'));
      return;
    }

    const document = editor.document;
    const docUri = document.uri;
    const documentDir = path.dirname(docUri.fsPath);

    const previewPanel = vscode.window.createWebviewPanel(
      'instantPreview',
      getTranslation('instantPreviewTitle', 'Instant Preview'),
      vscode.ViewColumn.Two,
      { 
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(documentDir)],
        enableFindWidget: true
      }
    );

    try {
      const iconPath = vscode.Uri.file(path.join(context.extensionPath, 'icon.png'));
      previewPanel.iconPath = iconPath;
    } catch (e) {
    }

    const getWebviewUri = (relativePath: string) => {
      const absolutePath = vscode.Uri.file(path.join(documentDir, relativePath));
      try {
        return (previewPanel.webview as any).asWebviewUri(absolutePath).toString();
      } catch (e) {
        return absolutePath.toString();
      }
    };

    const updateContent = (content: string) => {
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
            return '';
          }
          return match;
        }
      );

      const processedContent = content
        .replace(
          /<link[^>]*href=["']([^"']+)\.css["'][^>]*>/g,
          ''
        )
        .replace(
          /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/g,
          (match, src) => {
            if (src.startsWith('http')) return match;
            return '';
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

    let updateTimeout: NodeJS.Timeout | null = null;
    const debounceUpdate = (content: string) => {
      if (updateTimeout) clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        updateContent(content);
      }, getDebounceTime());
    };

    updateContent(document.getText());

    const changeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document === document) {
        debounceUpdate(e.document.getText());
      }
    });

    previewPanel.onDidDispose(() => {
      changeDisposable.dispose();
    });
  });
  context.subscriptions.push(instantPreviewCmd);

  const toggleCmd = vscode.commands.registerCommand('fast-http-server.toggleServer', async () => {
    if (!stopServer) {
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!folder) {
        vscode.window.showErrorMessage(getTranslation('noFolder', 'No folder is open in VS Code.'));
        return;
      }

      const portInput = await vscode.window.showInputBox({
        prompt: getTranslation('enterPort', 'Enter the port number for the server'),
        value: '5500',
        validateInput: (value) => /^\d+$/.test(value) ? null : getTranslation('invalidPort', 'Please enter a valid port number')
      });

      if (!portInput) return;
      const port = parseInt(portInput, 10);

      const available = await isPortAvailable(port);
      if (!available) {
        const tryLabel = getTranslation('tryAnotherPort', 'Try Another Port');
        const cancelLabel = getTranslation('cancel', 'Cancel');
        const portMsgTemplate = getTranslation('portInUse', `Port {port} is already in use. Choose another port?`);
        const portMsg = portMsgTemplate.replace('{port}', String(port));
        const tryAgain = await vscode.window.showErrorMessage(
          portMsg,
          tryLabel,
          cancelLabel
        );
        if (tryAgain === tryLabel) {
          return;
        } else {
          return;
        }
      }

      const files = await vscode.workspace.findFiles('**/*.html');
      const fileChoices = files.map(f => vscode.workspace.asRelativePath(f));
      const selectedFile = await vscode.window.showQuickPick(fileChoices, {
        placeHolder: getTranslation('selectHtml', 'Select the HTML file to open')
      });

      if (!selectedFile) return;

  const url = `http://localhost:${port}/${selectedFile}`;

      const choicePreview = getTranslation('previewInstant', 'Preview without server (Instant)');
      const choiceBrowser = getTranslation('openDefault', 'Open in default browser');
      const choiceWebview = getTranslation('openWebview', 'Open in VS Code WebView (Beta)');
      const choice = await vscode.window.showQuickPick(
        [choicePreview, choiceBrowser, choiceWebview],
        { placeHolder: getTranslation('howPreview', 'How do you want to preview?') }
      );

      if (choice === choicePreview) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage(getTranslation('noEditor', 'No active editor'));
          return;
        }

        const document = editor.document;
        const docUri = document.uri;
        const documentDir = path.dirname(docUri.fsPath);

        const previewPanel = vscode.window.createWebviewPanel(
          'instantPreview',
          getTranslation('instantPreviewTitle', 'Instant Preview'),
          vscode.ViewColumn.Two,
          { 
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.file(documentDir)],
            enableFindWidget: true
          }
        );

  const iconPath = vscode.Uri.file(path.join(context.extensionPath, 'icon.png'));
  previewPanel.iconPath = iconPath;

        const getWebviewUri = (relativePath: string) => {
          const absolutePath = path.join(documentDir, relativePath);
          return 'vscode-resource:' + absolutePath;
        };

        const updateContent = (content: string) => {
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
                return '';
              }
              return match;
            }
          );

          const processedContent = content
            .replace(
              /<link[^>]*href=["']([^"']+)\.css["'][^>]*>/g,
              ''
            )
            .replace(
              /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/g,
              (match, src) => {
                if (src.startsWith('http')) return match;
                return '';
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

        let updateTimeout: NodeJS.Timeout | null = null;
        const debounceUpdate = (content: string) => {
          if (updateTimeout) clearTimeout(updateTimeout);
          updateTimeout = setTimeout(() => {
            updateContent(content);
          }, getDebounceTime());
        };

        updateContent(document.getText());

        const changeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
          if (e.document === document) {
            debounceUpdate(e.document.getText());
          }
        });

        previewPanel.onDidDispose(() => {
          changeDisposable.dispose();
        });

        return;
      }

      stopServer = startServer(folder, port, async () => {
        if (choice === choiceBrowser) {
          open(url);
        } else if (choice === choiceWebview) {
          webviewPanel = vscode.window.createWebviewPanel(
            'fastHttpServer',
            getTranslation('fastHttpServerTitle', 'Fast HTTP Server'),
            vscode.ViewColumn.One,
            {
              enableScripts: true,
              retainContextWhenHidden: true,
              localResourceRoots: [vscode.Uri.file(folder), vscode.Uri.file(context.extensionPath)]
            }
          );

          try {
            const iconPath = vscode.Uri.file(path.join(context.extensionPath, 'icon.png'));
            webviewPanel.iconPath = iconPath;
          } catch (e) {
          }

          currentWebviewUrl = url;
          currentWebviewPort = port;
          const loadingText = getTranslation('loading', 'Loading preview...');
          webviewPanel.webview.html = getWebviewContent(url, port, loadingText);

          webviewPanel.onDidDispose(() => {
            webviewPanel = null;
            currentWebviewUrl = null;
            currentWebviewPort = null;
          });
        }
      });

      statusButton.text = getTranslation('stop', '$(debug-disconnect) Stop Fast HTTP');
      statusButton.tooltip = getTranslation('stopTooltip', 'Stop Fast HTTP Server');
    } else {
      stopServer();
      stopServer = null;
      if (webviewPanel) {
        webviewPanel.dispose();
        webviewPanel = null;
      }
      vscode.window.showInformationMessage(getTranslation('serverStopped', 'Server stopped.'));
      statusButton.text = getTranslation('start', '$(rocket) Start Fast HTTP');
      statusButton.tooltip = getTranslation('startTooltip', 'Start Fast HTTP Server');
    }
  });

  context.subscriptions.push(toggleCmd);

  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('liveServerSpeed.language')) {
      try { applyTranslations(); } catch (e) { /* ignore */ }
      if (webviewPanel && currentWebviewUrl && currentWebviewPort) {
        const loadingText = ((): string => {
          const lang = vscode.workspace.getConfiguration().get<string>('liveServerSpeed.language', 'en') || 'en';
          return TRANSLATIONS[lang]?.loading || TRANSLATIONS.en.loading;
        })();
        webviewPanel.webview.html = getWebviewContent(currentWebviewUrl, currentWebviewPort, loadingText);
      }
    }
  });
  context.subscriptions.push(configChangeDisposable);
}

function getWebviewContent(url: string, port: number, loadingText: string = 'Loading preview...'): string {
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
      <div id="loading">${loadingText}</div>
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
