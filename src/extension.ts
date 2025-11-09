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
let lastServerParams: { folder: string; port: number; selectedFile: string; useHttps: boolean; choice: string } | null = null;
let customShortcut: string | null = null;

const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    start: '$(rocket) Start Live Server SE',
    stop: '$(debug-disconnect) Stop Live Server SE',
    startTooltip: 'Start Live Server SE',
    stopTooltip: 'Stop Live Server SE',
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
    fastHttpServerTitle: 'Live Server SE',
    serverStopped: 'Server stopped.',
    chooseProtocol: 'Choose protocol (HTTPS requires accepting self-signed certificate)',
    httpsNotSupportedWebview: 'HTTPS is not supported in VS Code WebView due to self-signed certificate restrictions. Opening in default browser instead.',
    openKeybindingsMessage: 'In the Keyboard Shortcuts editor, search for "Live Server Speed Edition" to see and modify shortcuts for the extension.',
    languageDescription: 'Language used by the extension (en, fr, es, de)',
    debounceTimeDescription: 'Debounce time in milliseconds for file change detection and instant preview updates (50-1000ms)',
    relaunchShortcutDescription: 'Default keyboard shortcut for relaunching the server with last parameters (user can override in keybindings.json)',
    openKeybindingsDescription: 'Open Keyboard Shortcuts for Live Server Speed Edition (set to true to open)'
  },
  fr: {
    start: '$(rocket) Démarrer Live Server SE',
    stop: '$(debug-disconnect) Arrêter Live Server SE',
    startTooltip: "Démarrer le serveur Live Server SE",
    stopTooltip: "Arrêter le serveur Live Server SE",
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
    fastHttpServerTitle: "Live Server SE",
    serverStopped: "Serveur arrêté.",
    chooseProtocol: "Choisir le protocole (HTTPS nécessite d'accepter le certificat auto-signé)",
    httpsNotSupportedWebview: "HTTPS n'est pas supporté dans WebView VS Code en raison des restrictions de certificat auto-signé. Ouverture dans le navigateur par défaut à la place.",
    openKeybindingsMessage: "Dans l'éditeur de raccourcis clavier, recherchez 'Live Server Speed Edition' pour voir et modifier les raccourcis de l'extension.",
    languageDescription: "Langue utilisée par l'extension (en, fr, es, de)",
    debounceTimeDescription: "Temps de debounce en millisecondes pour la détection des changements de fichiers et les mises à jour de prévisualisation instantanée (50-1000ms)",
    relaunchShortcutDescription: "Raccourci clavier par défaut pour relancer le serveur avec les derniers paramètres (l'utilisateur peut le remplacer dans keybindings.json)",
    openKeybindingsDescription: "Ouvrir les Raccourcis Clavier pour Live Server Speed Edition (mettre à true pour ouvrir)"
  },
  es: {
    start: '$(rocket) Iniciar Live Server SE',
    stop: '$(debug-disconnect) Detener Live Server SE',
    startTooltip: 'Iniciar servidor Live Server SE',
    stopTooltip: 'Detener servidor Live Server SE',
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
    fastHttpServerTitle: 'Live Server SE',
    serverStopped: 'Servidor detenido.',
    chooseProtocol: 'Elegir protocolo (HTTPS requiere aceptar certificado auto-firmado)',
    httpsNotSupportedWebview: 'HTTPS no es compatible en WebView de VS Code debido a restricciones de certificado auto-firmado. Abriendo en navegador predeterminado en su lugar.',
    openKeybindingsMessage: 'En el editor de atajos de teclado, busca "Live Server Speed Edition" para ver y modificar los atajos de la extensión.',
    languageDescription: 'Idioma utilizado por la extensión (en, fr, es, de)',
    debounceTimeDescription: 'Tiempo de debounce en milisegundos para la detección de cambios de archivos y actualizaciones de vista previa instantánea (50-1000ms)',
    relaunchShortcutDescription: 'Atajo de teclado predeterminado para relanzar el servidor con los últimos parámetros (el usuario puede anularlo en keybindings.json)',
    openKeybindingsDescription: 'Abrir Atajos de Teclado para Live Server Speed Edition (establecer en true para abrir)'
  },
  de: {
    start: '$(rocket) Live Server SE starten',
    stop: '$(debug-disconnect) Live Server SE stoppen',
    startTooltip: 'Live Server SE Server starten',
    stopTooltip: 'Live Server SE Server stoppen',
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
    fastHttpServerTitle: 'Live Server SE',
    serverStopped: 'Server gestoppt.',
    chooseProtocol: 'Protokoll wählen (HTTPS erfordert Akzeptanz des selbstsignierten Zertifikats)',
    httpsNotSupportedWebview: 'HTTPS wird in VS Code WebView aufgrund von selbstsignierten Zertifikatsbeschränkungen nicht unterstützt. Stattdessen im Standardbrowser öffnen.',
    openKeybindingsMessage: 'Im Tastenkürzeleditor suchen Sie nach "Live Server Speed Edition", um die Tastenkürzel für die Erweiterung anzuzeigen und zu ändern.',
    languageDescription: 'Sprache, die von der Erweiterung verwendet wird (en, fr, es, de)',
    debounceTimeDescription: 'Debounce-Zeit in Millisekunden für die Dateiänderungserkennung und sofortige Vorschau-Updates (50-1000ms)',
    relaunchShortcutDescription: 'Standard-Tastenkürzel zum Neustarten des Servers mit den letzten Parametern (Benutzer kann es in keybindings.json überschreiben)',
    openKeybindingsDescription: 'Tastenkürzel für Live Server Speed Edition öffnen (auf true setzen, um zu öffnen)'
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

  function getConfigTranslation(key: string): string {
    const lang = vscode.workspace.getConfiguration().get<string>('liveServerSpeed.language', 'en') || 'en';
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
  }

  function getDebounceTime(): number {
    return vscode.workspace.getConfiguration().get<number>('liveServerSpeed.debounceTime', 50) || 50;
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

      const useHttps = await vscode.window.showQuickPick(
        ['HTTP', 'HTTPS'],
        { placeHolder: getTranslation('chooseProtocol', 'Choose protocol (HTTPS requires accepting self-signed certificate)') }
      );

      const isHttps = useHttps === 'HTTPS';

      const choicePreview = getTranslation('previewInstant', 'Preview without server (Instant)');
      const choiceBrowser = getTranslation('openDefault', 'Open in default browser');
      const choiceWebview = getTranslation('openWebview', 'Open in VS Code WebView (Beta)');

      let choices = [choicePreview, choiceBrowser];
      if (!isHttps) {
        choices.push(choiceWebview);
      }

      let choice = await vscode.window.showQuickPick(
        choices,
        { placeHolder: getTranslation('howPreview', 'How do you want to preview?') }
      );

      // Store last parameters
      lastServerParams = { folder, port, selectedFile, useHttps: isHttps, choice: choice || '' };

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

      stopServer = startServer(folder, port, async (serverUrl) => {
        if (choice === choiceBrowser) {
          open(serverUrl);
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

          currentWebviewUrl = serverUrl;
          currentWebviewPort = port;
          const loadingText = getTranslation('loading', 'Loading preview...');
          webviewPanel.webview.html = getWebviewContent(serverUrl, port, loadingText, isHttps);

          webviewPanel.onDidDispose(() => {
            webviewPanel = null;
            currentWebviewUrl = null;
            currentWebviewPort = null;
          });
        }
      }, undefined, isHttps);

      statusButton.text = getTranslation('stop', '$(debug-disconnect) Stop Live Server SE');
      statusButton.tooltip = getTranslation('stopTooltip', 'Stop Fast HTTP Server');
    } else {
      stopServer();
      stopServer = null;
      if (webviewPanel) {
        webviewPanel.dispose();
        webviewPanel = null;
      }
      vscode.window.showInformationMessage(getTranslation('serverStopped', 'Server stopped.'));
      statusButton.text = getTranslation('start', '$(rocket) Start Live Server SE');
      statusButton.tooltip = getTranslation('startTooltip', 'Start Fast HTTP Server');
    }
  });

  context.subscriptions.push(toggleCmd);

  const relaunchCmd = vscode.commands.registerCommand('fast-http-server.relaunchLast', async () => {
    if (!lastServerParams) {
      // If no previous launch, start the full server setup
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

      const useHttps = await vscode.window.showQuickPick(
        ['HTTP', 'HTTPS'],
        { placeHolder: getTranslation('chooseProtocol', 'Choose protocol (HTTPS requires accepting self-signed certificate)') }
      );

      const isHttps = useHttps === 'HTTPS';

      const choicePreview = getTranslation('previewInstant', 'Preview without server (Instant)');
      const choiceBrowser = getTranslation('openDefault', 'Open in default browser');
      const choiceWebview = getTranslation('openWebview', 'Open in VS Code WebView (Beta)');

      let choices = [choicePreview, choiceBrowser];
      if (!isHttps) {
        choices.push(choiceWebview);
      }

      let choice = await vscode.window.showQuickPick(
        choices,
        { placeHolder: getTranslation('howPreview', 'How do you want to preview?') }
      );

      // Store last parameters
      lastServerParams = { folder, port, selectedFile, useHttps: isHttps, choice: choice || '' };

      // Proceed with the launch logic as in toggleCmd
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

      stopServer = startServer(folder, port, async (serverUrl) => {
        if (choice === choiceBrowser) {
          open(serverUrl);
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

          currentWebviewUrl = serverUrl;
          currentWebviewPort = port;
          const loadingText = getTranslation('loading', 'Loading preview...');
          webviewPanel.webview.html = getWebviewContent(serverUrl, port, loadingText, isHttps);

          webviewPanel.onDidDispose(() => {
            webviewPanel = null;
            currentWebviewUrl = null;
            currentWebviewPort = null;
          });
        }
      }, undefined, isHttps);

      statusButton.text = getTranslation('stop', '$(debug-disconnect) Stop Live Server SE');
      statusButton.tooltip = getTranslation('stopTooltip', 'Stop Fast HTTP Server');
      return;
    }

    const { folder, port, selectedFile, useHttps, choice } = lastServerParams;

    const available = await isPortAvailable(port);
    if (!available) {
      vscode.window.showErrorMessage(`Port ${port} is already in use.`);
      return;
    }

    const choicePreview = getTranslation('previewInstant', 'Preview without server (Instant)');
    const choiceBrowser = getTranslation('openDefault', 'Open in default browser');
    const choiceWebview = getTranslation('openWebview', 'Open in VS Code WebView (Beta)');

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

    stopServer = startServer(folder, port, async (serverUrl) => {
      if (choice === choiceBrowser) {
        open(serverUrl);
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

        currentWebviewUrl = serverUrl;
        currentWebviewPort = port;
        const loadingText = getTranslation('loading', 'Loading preview...');
        webviewPanel.webview.html = getWebviewContent(serverUrl, port, loadingText, useHttps);

        webviewPanel.onDidDispose(() => {
          webviewPanel = null;
          currentWebviewUrl = null;
          currentWebviewPort = null;
        });
      }
    }, undefined, useHttps);

    statusButton.text = getTranslation('stop', '$(debug-disconnect) Stop Live Server SE');
    statusButton.tooltip = getTranslation('stopTooltip', 'Stop Fast HTTP Server');
  });

  context.subscriptions.push(relaunchCmd);

  const setShortcutCmd = vscode.commands.registerCommand('fast-http-server.setShortcut', async () => {
    const action = await vscode.window.showQuickPick(
      ['Open Keyboard Shortcuts', 'Show Command ID'],
      { placeHolder: 'Choose how to set the shortcut' }
    );

    if (action === 'Open Keyboard Shortcuts') {
      vscode.commands.executeCommand('workbench.action.openGlobalKeybindings');
      vscode.window.showInformationMessage('In the Keyboard Shortcuts editor, search for "Relaunch Live Server with Last Parameters" and assign your desired key combination.');
    } else if (action === 'Show Command ID') {
      vscode.env.clipboard.writeText('fast-http-server.relaunchLast');
      vscode.window.showInformationMessage('Command ID copied to clipboard: fast-http-server.relaunchLast. Use this in your keybindings.json to assign a shortcut.');
    }
  });

  context.subscriptions.push(setShortcutCmd);

  const openKeybindingsCmd = vscode.commands.registerCommand('fast-http-server.openKeybindings', async () => {
    await vscode.commands.executeCommand('workbench.action.openGlobalKeybindings');
    const message = getTranslation('openKeybindingsMessage', 'In the Keyboard Shortcuts editor, search for "Live Server Speed Edition" to see and modify shortcuts for the extension.');
    vscode.window.showInformationMessage(message);
  });

  context.subscriptions.push(openKeybindingsCmd);

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
    if (e.affectsConfiguration('liveServerSpeed.openKeybindings')) {
      const openKeybindings = vscode.workspace.getConfiguration().get<boolean>('liveServerSpeed.openKeybindings', false);
      if (openKeybindings) {
        vscode.commands.executeCommand('fast-http-server.openKeybindings');
        // Reset to false after opening
        vscode.workspace.getConfiguration().update('liveServerSpeed.openKeybindings', false, vscode.ConfigurationTarget.Global);
      }
    }
  });
  context.subscriptions.push(configChangeDisposable);
}

function getWebviewContent(url: string, port: number, loadingText: string = 'Loading preview...', isHttps: boolean = false): string {
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
        const protocol = ${isHttps} ? 'wss' : 'ws';
        const ws = new WebSocket(protocol + '://localhost:${port}');
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
