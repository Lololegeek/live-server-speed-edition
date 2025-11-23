import * as vscode from 'vscode';
import { startServer } from './server';
import open from 'open';
import chokidar from 'chokidar';
import * as path from 'path';
import * as net from 'net';
import * as os from 'os';
import * as fs from 'fs';



let stopServer: (() => void) | null = null;
let webviewPanel: vscode.WebviewPanel | null = null;
let currentWebviewReady: boolean = false;
let statusButton: vscode.StatusBarItem;
let qrButton: vscode.StatusBarItem;
let reopenWebviewButton: vscode.StatusBarItem;
let currentWebviewUrl: string | null = null;
let currentWebviewPort: number | null = null;
let currentWebviewIsHttps: boolean | null = null;
let currentDetectedIP: string = 'localhost';
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
    qrCode: 'QR Code',
    qrCodeTooltip: 'Show QR Code for server access',
    reopenWebview: 'Re-open WebView',
    reopenWebviewTooltip: 'Re-open the WebView preview',
    scanToAccess: 'Scan to access server',
    qrNetworkOnly: 'Accessible only on your local network',
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
    chooseProtocol: 'Choose protocol (WebView dont work in HTTPS) (HTTPS requires accepting self-signed certificate)',
    httpsNotSupportedWebview: 'HTTPS in VS Code WebView may show security warnings due to self-signed certificates. For best experience, use HTTP or open in your default browser.',
  webviewNotSupportedShort: "(WebView won't work)",
    openKeybindingsMessage: 'In the Keyboard Shortcuts editor, search for "Live Server Speed Edition" to see and modify shortcuts for the extension.',
    languageDescription: 'Language used by the extension (en, fr, es, de)',
    debounceTimeDescription: 'Debounce time in milliseconds for file change detection and instant preview updates (50-1000ms)',
    relaunchShortcutDescription: 'Default keyboard shortcut for relaunching the server with last parameters (user can override in keybindings.json)',
    openKeybindingsDescription: 'Open Keyboard Shortcuts for Live Server Speed Edition (set to true to open)',
    defaultIPDescription: 'Default IP address for the server (leave empty to auto-detect)'
  },
  fr: {
    start: '$(rocket) Démarrer Live Server SE',
    stop: '$(debug-disconnect) Arrêter Live Server SE',
    startTooltip: "Démarrer le serveur Live Server SE",
    stopTooltip: "Arrêter le serveur Live Server SE",
    instantPreview: '$(eye) Prévisualisation instantanée',
    instantPreviewTooltip: "Afficher la prévisualisation du fichier HTML courant",
    qrCode: 'Code QR',
    qrCodeTooltip: "Afficher le code QR pour l'accès au serveur",
    reopenWebview: 'Rouvrir WebView',
    reopenWebviewTooltip: 'Rouvrir la prévisualisation WebView',
    scanToAccess: 'Scanner pour accéder au serveur',
    qrNetworkOnly: "Accessible uniquement sur votre réseau local",
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
    chooseProtocol: "Choisir le protocole (WeView ne marche pas en HTTPS) (HTTPS nécessite d'accepter le certificat auto-signé)",
    httpsNotSupportedWebview: "HTTPS dans WebView VS Code peut afficher des avertissements de sécurité en raison des certificats auto-signés. Pour une meilleure expérience, utilisez HTTP ou ouvrez dans votre navigateur par défaut.",
  webviewNotSupportedShort: "(WebView ne fonctionne pas)",
    openKeybindingsMessage: "Dans l'éditeur de raccourcis clavier, recherchez 'Live Server Speed Edition' pour voir et modifier les raccourcis de l'extension.",
    languageDescription: "Langue utilisée par l'extension (en, fr, es, de)",
    debounceTimeDescription: "Temps de debounce en millisecondes pour la détection des changements de fichiers et les mises à jour de prévisualisation instantanée (50-1000ms)",
    relaunchShortcutDescription: "Raccourci clavier par défaut pour relancer le serveur avec les derniers paramètres (l'utilisateur peut le remplacer dans keybindings.json)",
    openKeybindingsDescription: "Ouvrir les Raccourcis Clavier pour Live Server Speed Edition (mettre à true pour ouvrir)",
    defaultIPDescription: "Adresse IP par défaut pour le serveur (laisser vide pour auto-détection)"
  },
  es: {
    start: '$(rocket) Iniciar Live Server SE',
    stop: '$(debug-disconnect) Detener Live Server SE',
    startTooltip: 'Iniciar servidor Live Server SE',
    stopTooltip: 'Detener servidor Live Server SE',
    instantPreview: '$(eye) Vista instantánea',
    instantPreviewTooltip: 'Mostrar vista previa del archivo HTML actual',
    qrCode: 'Código QR',
    qrCodeTooltip: 'Mostrar código QR para acceso al servidor',
    reopenWebview: 'Reabrir WebView',
    reopenWebviewTooltip: 'Reabrir la vista previa de WebView',
    scanToAccess: 'Escanear para acceder al servidor',
    qrNetworkOnly: 'Accesible solo en su red local',
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
    httpsNotSupportedWebview: 'HTTPS en VS Code WebView puede mostrar advertencias de seguridad debido a certificados autofirmados. Para la mejor experiencia, use HTTP o abra en su navegador predeterminado.',
  webviewNotSupportedShort: "(WebView no funciona)",
    openKeybindingsMessage: 'En el editor de atajos de teclado, busca "Live Server Speed Edition" para ver y modificar los atajos de la extensión.',
    languageDescription: 'Idioma utilizado por la extensión (en, fr, es, de)',
    debounceTimeDescription: 'Tiempo de debounce en milisegundos para la detección de cambios de archivos y actualizaciones de vista previa instantánea (50-1000ms)',
    relaunchShortcutDescription: 'Atajo de teclado predeterminado para relanzar el servidor con los últimos parámetros (el usuario puede anularlo en keybindings.json)',
    openKeybindingsDescription: 'Abrir Atajos de Teclado para Live Server Speed Edition (establecer en true para abrir)',
    defaultIPDescription: 'Dirección IP predeterminada para el servidor (dejar vacío para auto-detectar)'
  },
  de: {
    start: '$(rocket) Live Server SE starten',
    stop: '$(debug-disconnect) Live Server SE stoppen',
    startTooltip: 'Live Server SE Server starten',
    stopTooltip: 'Live Server SE Server stoppen',
    instantPreview: '$(eye) Sofortvorschau',
    instantPreviewTooltip: 'Sofortvorschau der aktuellen HTML-Datei anzeigen',
    qrCode: 'QR-Code',
    qrCodeTooltip: 'QR-Code für Serverzugriff anzeigen',
    reopenWebview: 'WebView erneut öffnen',
    reopenWebviewTooltip: 'WebView-Vorschau erneut öffnen',
    scanToAccess: 'Scannen, um auf den Server zuzugreifen',
    qrNetworkOnly: 'Nur im lokalen Netzwerk zugänglich',
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
    httpsNotSupportedWebview: 'HTTPS in VS Code WebView kann aufgrund von selbstsignierten Zertifikaten Sicherheitswarnungen anzeigen. Verwenden Sie für die beste Erfahrung HTTP oder öffnen Sie im Standardbrowser.',
  webviewNotSupportedShort: "(WebView funktioniert nicht)",
    openKeybindingsMessage: 'Im Tastenkürzeleditor suchen Sie nach "Live Server Speed Edition", um die Tastenkürzel für die Erweiterung anzuzeigen und zu ändern.',
    languageDescription: 'Sprache, die von der Erweiterung verwendet wird (en, fr, es, de)',
    debounceTimeDescription: 'Debounce-Zeit in Millisekunden für die Dateiänderungserkennung und sofortige Vorschau-Updates (50-1000ms)',
    relaunchShortcutDescription: 'Standard-Tastenkürzel zum Neustarten des Servers mit den letzten Parametern (Benutzer kann es in keybindings.json überschreiben)',
    openKeybindingsDescription: 'Tastenkürzel für Live Server Speed Edition öffnen (auf true setzen, um zu öffnen)',
    defaultIPDescription: 'Standard-IP-Adresse für den Server (leer lassen für automatische Erkennung)'
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

// Function to detect the active network IP address
function detectNetworkIP(): string {
  let detectedIP = vscode.workspace.getConfiguration().get<string>('liveServerSpeed.defaultIP', '') || '';
  if (detectedIP === '') {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name]?.find(i => i.family === 'IPv4' && !i.internal);
      if (iface) {
        if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wifi') || name.toLowerCase().includes('wlan')) {
          detectedIP = iface.address;
          break;
        } else if (name.toLowerCase().includes('ethernet') && detectedIP === '') {
          detectedIP = iface.address;
        } else if (detectedIP === '') {
          detectedIP = iface.address;
        }
      }
    }
  }
  return detectedIP || 'localhost';
}

// Helper to extract and inject CSS/JS from HTML content
function extractCssAndJsFromHtml(content: string, documentDir: string): { css: Set<string>; js: Set<string>; processed: string } {
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
  let processedContent = content.replace(
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

  processedContent = processedContent
    .replace(/<link[^>]*href=["']([^"']+)\.css["'][^>]*>/g, '')
    .replace(/<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/g, (match, src) => {
      if (src.startsWith('http')) return match;
      return '';
    });

  return { css: cssInjections, js: scriptInjections, processed: processedContent };
}

export function activate(context: vscode.ExtensionContext) {
  statusButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  const instantPreviewButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  qrButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
  reopenWebviewButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 97);

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
    // QR button translations (may be hidden until webview opens)
    try {
      qrButton.text = '$(qr-code) ' + getTranslation('qrCode', 'QR Code');
      qrButton.tooltip = getTranslation('qrCodeTooltip', 'Show QR Code for server access');
    } catch (e) { }
    // Re-open WebView button translations
    try {
      reopenWebviewButton.text = '$(window) ' + getTranslation('reopenWebview', 'Re-open WebView');
      reopenWebviewButton.tooltip = getTranslation('reopenWebviewTooltip', 'Re-open the WebView preview');
    } catch (e) { }
  };

  applyTranslations();

  statusButton.command = 'fast-http-server.toggleServer';
  statusButton.show();
  context.subscriptions.push(statusButton);

  instantPreviewButton.command = 'fast-http-server.instantPreview';
  instantPreviewButton.show();
  context.subscriptions.push(instantPreviewButton);

  // QR status bar button (hidden until a webview server preview is opened)
  qrButton.command = 'fast-http-server.showQr';
  qrButton.tooltip = getTranslation('qrCodeTooltip', 'Show QR Code for server access');
  qrButton.text = '$(qr-code) ' + getTranslation('qrCode', 'QR Code');
  qrButton.hide();
  context.subscriptions.push(qrButton);

  // Re-open WebView button (hidden until a webview server preview is opened)
  reopenWebviewButton.command = 'fast-http-server.reopenWebview';
  reopenWebviewButton.tooltip = getTranslation('reopenWebviewTooltip', 'Re-open the WebView preview');
  reopenWebviewButton.text = '$(window) ' + getTranslation('reopenWebview', 'Re-open WebView');
  reopenWebviewButton.hide();
  context.subscriptions.push(reopenWebviewButton);

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
      const { css: cssInjections, js: scriptInjections, processed: processedContent } = extractCssAndJsFromHtml(content, documentDir);

      // Handle image paths for the webview
      const imagePath = processedContent.replace(
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
          ${imagePath}
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

  // Command to re-open webview
  const reopenWebviewCmd = vscode.commands.registerCommand('fast-http-server.reopenWebview', async () => {
    if (!currentWebviewUrl || !currentWebviewPort || currentWebviewIsHttps === null) {
      vscode.window.showInformationMessage(getTranslation('noEditor', 'No active editor'));
      return;
    }

    // Close existing webview if any
    if (webviewPanel) {
      webviewPanel.dispose();
      webviewPanel = null;
    }

    // Re-create the webview with the same parameters
    const folder = lastServerParams?.folder || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    webviewPanel = vscode.window.createWebviewPanel(
      'fastHttpServer',
      getTranslation('fastHttpServerTitle', 'Live Server SE'),
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

    const loadingText = getTranslation('loading', 'Loading preview...');
    const qrCodeText = getTranslation('qrCode', 'QR Code');
    const qrCodeTooltip = getTranslation('qrCodeTooltip', 'Show QR Code for server access');
    const scanToAccessText = getTranslation('scanToAccess', 'Scan to access server');
    const qrNetworkOnlyText = getTranslation('qrNetworkOnly', 'Accessible only on your local network');
    webviewPanel.webview.html = getWebviewContent(currentWebviewUrl, currentWebviewPort, loadingText, currentWebviewIsHttps, qrCodeText, qrCodeTooltip, scanToAccessText, qrNetworkOnlyText, currentDetectedIP);
    
    currentWebviewReady = false;
    try {
      webviewPanel.webview.onDidReceiveMessage(msg => {
        try { console.log('Extension received message from webview:', msg); } catch (e) {}
        if (msg && msg.type === 'webview-ready') {
          currentWebviewReady = true;
          try { console.log('Webview signalled ready'); } catch (e) {}
        }
      });
    } catch (e) {}

    webviewPanel.onDidDispose(() => {
      webviewPanel = null;
      // Ne pas réinitialiser les variables ni cacher les boutons
      // car le serveur est toujours actif
    });
  });
  context.subscriptions.push(reopenWebviewCmd);

  // Command to show QR in the currently opened webview
  const showQrCmd = vscode.commands.registerCommand('fast-http-server.showQr', async () => {
    // Compute the URL to show in the QR (prefer network-accessible URL)
    const url = (() => {
      if (currentWebviewPort && currentWebviewIsHttps !== null) {
        try {
          const parsed = new URL(currentWebviewUrl || `http${currentWebviewIsHttps ? 's' : ''}://localhost:${currentWebviewPort}`);
          const confIP = vscode.workspace.getConfiguration().get<string>('liveServerSpeed.defaultIP', '');
          if (confIP && confIP !== '') parsed.hostname = confIP;
          return parsed.toString();
        } catch (e) {
          return currentWebviewUrl || '';
        }
      }
      // Fallback to last known URL or construct from lastServerParams
      if (currentWebviewUrl) return currentWebviewUrl;
      if (lastServerParams) {
        return `http${lastServerParams.useHttps ? 's' : ''}://${detectNetworkIP()}:${lastServerParams.port}/${lastServerParams.selectedFile}`;
      }
      return '';
    })();

    // If we don't have any URL, show a friendly message
    if (!url) {
      vscode.window.showInformationMessage(getTranslation('noEditor', 'No active editor'));
      return;
    }

    // Open a dedicated WebView panel that only shows the QR and related info
    const qrPanel = vscode.window.createWebviewPanel(
      'fastHttpServerQr',
      getTranslation('qrCode', 'QR Code'),
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.file(context.extensionPath)] }
    );
    try { qrPanel.iconPath = vscode.Uri.file(path.join(context.extensionPath, 'icon.png')); } catch (e) {}

    const scanToAccessText = getTranslation('scanToAccess', 'Scan to access server');
    const qrNetworkOnlyText = getTranslation('qrNetworkOnly', 'Accessible only on your local network');
    qrPanel.webview.html = getQrWebviewContent(url, currentDetectedIP, scanToAccessText, qrNetworkOnlyText, getTranslation('qrCode', 'QR Code'));
    // Handle messages from the QR panel (open in browser / copy URL)
    try {
      qrPanel.webview.onDidReceiveMessage(async (m: any) => {
        try {
          if (!m || !m.type) return;
          if (m.type === 'open-url') {
            try { open(m.url); } catch (e) { vscode.window.showInformationMessage(m.url); }
          } else if (m.type === 'copy-url') {
            try { await vscode.env.clipboard.writeText(m.url); vscode.window.showInformationMessage('URL copied to clipboard'); } catch (e) { vscode.window.showWarningMessage('Failed to copy URL'); }
          }
        } catch (e) {}
      });
    } catch (e) {}
    // No further action needed — the QR panel is independent of the preview
  });
  context.subscriptions.push(showQrCmd);

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

      // Show protocol picker with short note that WebView won't work for HTTPS
      const shortNote = getTranslation('webviewNotSupportedShort', "(WebView won't work)");
      const protocolChoices: vscode.QuickPickItem[] = [
        { label: 'HTTP' },
        { label: 'HTTPS', description: shortNote }
      ];
      const pickedProtocol = await vscode.window.showQuickPick(protocolChoices, { placeHolder: getTranslation('chooseProtocol', 'Choose protocol (HTTPS requires accepting self-signed certificate)') });
      const isHttps = pickedProtocol?.label === 'HTTPS';

      const choicePreview = getTranslation('previewInstant', 'Preview without server (Instant)');
      const choiceBrowser = getTranslation('openDefault', 'Open in default browser');
      const choiceWebview = getTranslation('openWebview', 'Open in VS Code WebView (Beta)');

      let choices = [choicePreview, choiceBrowser];
      // Add WebView option only for HTTP (not HTTPS due to certificate limitations)
      if (!isHttps) {
        choices.push(choiceWebview);
      }
      
      // Show HTTPS warning if applicable
      if (isHttps) {
        vscode.window.showWarningMessage(getTranslation('httpsNotSupportedWebview', 'HTTPS in VS Code WebView may show security warnings due to self-signed certificates. For best experience, use HTTP or open in your default browser.'));
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
          const { css: cssInjections, js: scriptInjections, processed: processedContent } = extractCssAndJsFromHtml(content, documentDir);

          // Handle image paths for the webview
          const imagePath = processedContent.replace(
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
              ${imagePath}
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

      // Determine certificate paths for HTTPS if needed
      const confCertPath = vscode.workspace.getConfiguration().get<string>('liveServerSpeed.httpsCertPath', '') || '';
      const confKeyPath = vscode.workspace.getConfiguration().get<string>('liveServerSpeed.httpsKeyPath', '') || '';
      const autoGenerate = vscode.workspace.getConfiguration().get<boolean>('liveServerSpeed.httpsAutoGenerate', true);
      let certPathToUse: string | undefined = confCertPath || undefined;
      let keyPathToUse: string | undefined = confKeyPath || undefined;
      if (isHttps && !certPathToUse && !keyPathToUse && autoGenerate) {
        try {
          const baseStorage = context.globalStoragePath || path.join(os.tmpdir(), 'live-server-speed');
          const certDir = path.join(baseStorage, 'certs');
          if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });
          certPathToUse = path.join(certDir, 'cert.pem');
          keyPathToUse = path.join(certDir, 'key.pem');
        } catch (e) {}
      }

      stopServer = startServer(folder, port, async (serverUrls: string | { localhost: string; network: string }) => {
        const serverUrl = typeof serverUrls === 'string' ? serverUrls : serverUrls.localhost;
        const networkUrl = typeof serverUrls === 'string' ? serverUrls : serverUrls.network;

        // Detect active network interface IP
        currentDetectedIP = detectNetworkIP();
        const customNetworkUrl = `http${isHttps ? 's' : ''}://${currentDetectedIP}:${port}`;

        if (choice === choiceBrowser) {
          // Open the selected file path in the browser when using the browser option
          try { open(`${customNetworkUrl}/${selectedFile}`); } catch (e) { try { open(customNetworkUrl); } catch (e) {} }
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

          const webviewUrl = `${customNetworkUrl}/${selectedFile}`;
          currentWebviewUrl = webviewUrl;
          currentWebviewPort = port;
          currentWebviewIsHttps = isHttps;
          const loadingText = getTranslation('loading', 'Loading preview...');
          const qrCodeText = getTranslation('qrCode', 'QR Code');
          const qrCodeTooltip = getTranslation('qrCodeTooltip', 'Show QR Code for server access');
          const scanToAccessText = getTranslation('scanToAccess', 'Scan to access server');
          const qrNetworkOnlyText = getTranslation('qrNetworkOnly', 'Accessible only on your local network');
          webviewPanel.webview.html = getWebviewContent(webviewUrl, port, loadingText, isHttps, qrCodeText, qrCodeTooltip, scanToAccessText, qrNetworkOnlyText, currentDetectedIP);
          // mark webview as not ready until it signals back
          currentWebviewReady = false;
          try {
            webviewPanel.webview.onDidReceiveMessage(msg => {
              try { console.log('Extension received message from webview:', msg); } catch (e) {}
              if (msg && msg.type === 'webview-ready') {
                currentWebviewReady = true;
                try { console.log('Webview signalled ready'); } catch (e) {}
              }
            });
          } catch (e) {}
          // Show QR and Re-open WebView status buttons when server webview is open
          try { qrButton.show(); } catch (e) { }
          try { reopenWebviewButton.show(); } catch (e) { }

          webviewPanel.onDidDispose(() => {
            webviewPanel = null;
            // Ne pas réinitialiser les variables ni cacher les boutons
            // car le serveur est toujours actif
          });
        }
  }, undefined, isHttps, certPathToUse, keyPathToUse);

      statusButton.text = getTranslation('stop', '$(debug-disconnect) Stop Live Server SE');
      statusButton.tooltip = getTranslation('stopTooltip', 'Stop Fast HTTP Server');
    } else {
      stopServer();
      stopServer = null;
      if (webviewPanel) {
        webviewPanel.dispose();
        webviewPanel = null;
      }
      // Cacher les boutons QR et Re-open WebView quand le serveur s'arrête
      try { qrButton.hide(); } catch (e) { }
      try { reopenWebviewButton.hide(); } catch (e) { }
      // Réinitialiser les variables
      currentWebviewUrl = null;
      currentWebviewPort = null;
      currentWebviewIsHttps = null;
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
      // Add WebView option only for HTTP (not HTTPS due to certificate limitations)
      if (!isHttps) {
        choices.push(choiceWebview);
      }
      
      // Show HTTPS warning if applicable
      if (isHttps) {
        vscode.window.showWarningMessage(getTranslation('httpsNotSupportedWebview', 'HTTPS in VS Code WebView may show security warnings due to self-signed certificates. For best experience, use HTTP or open in your default browser.'));
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
          const { css: cssInjections, js: scriptInjections, processed: processedContent } = extractCssAndJsFromHtml(content, documentDir);

          // Handle image paths for the webview
          const imagePath = processedContent.replace(
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
              ${imagePath}
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

  stopServer = startServer(folder, port, async (serverUrls) => {
        const serverUrl = typeof serverUrls === 'string' ? serverUrls : serverUrls.localhost;
        const networkUrl = typeof serverUrls === 'string' ? serverUrls : serverUrls.network;
        if (choice === choiceBrowser) {
          try { open(`${networkUrl}/${selectedFile}`); } catch (e) { try { open(networkUrl); } catch (e) {} }
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

          // Prefer network URL (accessible from other devices) for preview and QR
          currentDetectedIP = detectNetworkIP();
          currentWebviewUrl = networkUrl;
          currentWebviewPort = port;
          currentWebviewIsHttps = isHttps;
          const loadingText = getTranslation('loading', 'Loading preview...');
          const qrCodeText = getTranslation('qrCode', 'QR Code');
          const qrCodeTooltip = getTranslation('qrCodeTooltip', 'Show QR Code for server access');
          const scanToAccessText = getTranslation('scanToAccess', 'Scan to access server');
          const qrNetworkOnlyText = getTranslation('qrNetworkOnly', 'Accessible only on your local network');
          webviewPanel.webview.html = getWebviewContent(networkUrl, port, loadingText, isHttps, qrCodeText, qrCodeTooltip, scanToAccessText, qrNetworkOnlyText, currentDetectedIP);
          // mark webview as not ready until it signals back
          currentWebviewReady = false;
          try {
            webviewPanel.webview.onDidReceiveMessage(msg => {
              try { console.log('Extension received message from webview:', msg); } catch (e) {}
              if (msg && msg.type === 'webview-ready') {
                currentWebviewReady = true;
                try { console.log('Webview signalled ready'); } catch (e) {}
              }
            });
          } catch (e) {}
          try { qrButton.show(); } catch (e) { }
          try { reopenWebviewButton.show(); } catch (e) { }

          webviewPanel.onDidDispose(() => {
            webviewPanel = null;
            // Ne pas réinitialiser les variables ni cacher les boutons
            // car le serveur est toujours actif
          });
        }
  }, undefined, isHttps, undefined, undefined);

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

    // Determine certificate paths for HTTPS if needed (for relaunch path)
    const confCertPath2 = vscode.workspace.getConfiguration().get<string>('liveServerSpeed.httpsCertPath', '') || '';
    const confKeyPath2 = vscode.workspace.getConfiguration().get<string>('liveServerSpeed.httpsKeyPath', '') || '';
    const autoGenerate2 = vscode.workspace.getConfiguration().get<boolean>('liveServerSpeed.httpsAutoGenerate', true);
    let certPathToUse2: string | undefined = confCertPath2 || undefined;
    let keyPathToUse2: string | undefined = confKeyPath2 || undefined;
    if (useHttps && !certPathToUse2 && !keyPathToUse2 && autoGenerate2) {
      try {
        const baseStorage = context.globalStoragePath || path.join(os.tmpdir(), 'live-server-speed');
        const certDir = path.join(baseStorage, 'certs');
        if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });
        certPathToUse2 = path.join(certDir, 'cert.pem');
        keyPathToUse2 = path.join(certDir, 'key.pem');
      } catch (e) {}
    }

    stopServer = startServer(folder, port, async (serverUrls: string | { localhost: string; network: string }) => {
      const serverUrl = typeof serverUrls === 'string' ? serverUrls : serverUrls.localhost;
      const networkUrl = typeof serverUrls === 'string' ? serverUrls : serverUrls.network;
        if (choice === choiceBrowser) {
          try { open(`${networkUrl}/${selectedFile}`); } catch (e) { try { open(networkUrl); } catch (e) {} }
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

        currentWebviewUrl = networkUrl;
        currentDetectedIP = detectNetworkIP();
        currentWebviewPort = port;
        currentWebviewIsHttps = useHttps;
        const loadingText = getTranslation('loading', 'Loading preview...');
        const qrCodeText = getTranslation('qrCode', 'QR Code');
        const qrCodeTooltip = getTranslation('qrCodeTooltip', 'Show QR Code for server access');
        const scanToAccessText = getTranslation('scanToAccess', 'Scan to access server');
        const qrNetworkOnlyText = getTranslation('qrNetworkOnly', 'Accessible only on your local network');
        webviewPanel.webview.html = getWebviewContent(networkUrl, port, loadingText, useHttps, qrCodeText, qrCodeTooltip, scanToAccessText, qrNetworkOnlyText, currentDetectedIP);
        // mark webview as not ready until it signals back
        currentWebviewReady = false;
        try {
          webviewPanel.webview.onDidReceiveMessage(msg => {
            try { console.log('Extension received message from webview:', msg); } catch (e) {}
            if (msg && msg.type === 'webview-ready') {
              currentWebviewReady = true;
              try { console.log('Webview signalled ready'); } catch (e) {}
            }
          });
        } catch (e) {}
        try { qrButton.show(); } catch (e) { }
        try { reopenWebviewButton.show(); } catch (e) { }

        webviewPanel.onDidDispose(() => {
          webviewPanel = null;
          // Ne pas réinitialiser les variables ni cacher les boutons
          // car le serveur est toujours actif
        });
      }
  }, undefined, useHttps, certPathToUse2, keyPathToUse2);

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
        const lang = vscode.workspace.getConfiguration().get<string>('liveServerSpeed.language', 'en') || 'en';
        const qrCodeText = TRANSLATIONS[lang]?.qrCode || TRANSLATIONS.en.qrCode;
        const qrCodeTooltip = TRANSLATIONS[lang]?.qrCodeTooltip || TRANSLATIONS.en.qrCodeTooltip;
        const scanToAccessText = TRANSLATIONS[lang]?.scanToAccess || TRANSLATIONS.en.scanToAccess;
        const qrNetworkOnlyText = TRANSLATIONS[lang]?.qrNetworkOnly || TRANSLATIONS.en.qrNetworkOnly;
        webviewPanel.webview.html = getWebviewContent(currentWebviewUrl, currentWebviewPort, loadingText, currentWebviewIsHttps || false, qrCodeText, qrCodeTooltip, scanToAccessText, qrNetworkOnlyText, currentDetectedIP);
        // Reset ready flag when re-rendering webview
        currentWebviewReady = false;
        try {
          webviewPanel.webview.onDidReceiveMessage(msg => {
            try { console.log('Extension received message from webview:', msg); } catch (e) {}
            if (msg && msg.type === 'webview-ready') {
              currentWebviewReady = true;
              try { console.log('Webview signalled ready'); } catch (e) {}
            }
          });
        } catch (e) {}
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

function getWebviewContent(url: string, port: number, loadingText: string = 'Loading preview...', isHttps: boolean = false, qrCodeText: string = 'QR Code', qrCodeTooltip: string = 'Show QR Code for server access', scanToAccessText: string = 'Scan to access server', qrNetworkOnlyText: string = 'Accessible only on your local network', detectedIP: string = 'localhost'): string {
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
        /* QR modal (opened via extension postMessage) */
        #qrModal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.7);
          z-index: 1001;
          justify-content: center;
          align-items: center;
        }
        #qrModal.show {
          display: flex;
        }
        #qrContent {
          background-color: white;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          position: relative;
          max-width: 90%;
        }
        #qrClose {
          position: absolute;
          top: 10px;
          right: 10px;
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #333;
        }
        #qrCanvas {
          margin-top: 10px;
        }
        #loading {
          display: none;
        }
      </style>
    </head>
    <body>
      <div id="loading">${loadingText}</div>
      <div id="qrModal">
        <div id="qrContent">
          <button id="qrClose">&times;</button>
          <h3>${scanToAccessText}</h3>
          <div id="qrCanvas"></div>
          <p style="margin-top:12px;font-size:12px;color:#666;">${qrNetworkOnlyText}</p>
          <p style="margin-top:8px;font-size:11px;color:#999;">IP: <strong>${detectedIP}</strong></p>
        </div>
      </div>
      <iframe id="previewFrame"
              src="${url}"
              onload="injectConsoleFilter(document.getElementById('previewFrame'));"
              onerror="console.error('Failed to load iframe:', event)">
      </iframe>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      <script>
        // VS Code API for the Webview
        const vscode = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : undefined;

        // Hide loading element
        function hideLoading() {
          const loadingEl = document.getElementById('loading');
          if (loadingEl) loadingEl.style.display = 'none';
        }
        
        // Inject console filter into iframe
        function injectConsoleFilter(iframeEl: HTMLIFrameElement) {
          try {
            const iframeDoc = iframeEl.contentDocument || iframeEl.contentWindow?.document;
            if (!iframeDoc) {
              hideLoading();
              return;
            }
            const script = iframeDoc.createElement('script');
            script.textContent = `
              const originalLog = console.log;
              const originalWarn = console.warn;
              const originalError = console.error;
              const originalInfo = console.info;
              
              const isUnwantedLog = (args: any) => {
                const str = String(args[0] || '');
                return str.includes('START_NATIVE_LOG') || 
                       str.includes('END_NATIVE_LOG') ||
                       str.includes('DIRECT') ||
                       str.includes('dtelemetryAppenderlog') ||
                       str.includes('telemetry') ||
                       str.includes('user.auth_logged_out') ||
                       str.includes('CodeWindow') ||
                       str.includes('ERR_CERT_AUTHORITY_INVALID') ||
                       str.includes('Electron') ||
                       str.includes('electron:');
              };
              
              console.log = function(...args: any) {
                if (!isUnwantedLog(args)) originalLog.apply(console, args);
              };
              console.warn = function(...args: any) {
                if (!isUnwantedLog(args)) originalWarn.apply(console, args);
              };
              console.error = function(...args: any) {
                if (!isUnwantedLog(args)) originalError.apply(console, args);
              };
              console.info = function(...args: any) {
                if (!isUnwantedLog(args)) originalInfo.apply(console, args);
              };
            `;
            iframeDoc.head.appendChild(script);
            hideLoading();
          } catch (e) {
            // Even if injection fails, hide loading after short delay
            hideLoading();
          }
        }
        
        // Filter out unwanted native logs and telemetry data
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;
        const originalInfo = console.info;
        
        const isUnwantedLog = (args: any) => {
          const str = String(args[0] || '');
          return str.includes('START_NATIVE_LOG') || 
                 str.includes('END_NATIVE_LOG') ||
                 str.includes('DIRECT') ||
                 str.includes('dtelemetryAppenderlog') ||
                 str.includes('telemetry') ||
                 str.includes('user.auth_logged_out') ||
                 str.includes('CodeWindow') ||
                 str.includes('ERR_CERT_AUTHORITY_INVALID') ||
                 str.includes('Electron') ||
                 str.includes('electron:');
        };
        
        console.log = function(...args: any) {
          if (!isUnwantedLog(args)) originalLog.apply(console, args);
        };
        console.warn = function(...args: any) {
          if (!isUnwantedLog(args)) originalWarn.apply(console, args);
        };
        console.error = function(...args: any) {
          if (!isUnwantedLog(args)) originalError.apply(console, args);
        };
        console.info = function(...args: any) {
          if (!isUnwantedLog(args)) originalInfo.apply(console, args);
        };
        
  const frame = document.getElementById('previewFrame');
        
        // Fallback: hide loading after 1 second if iframe hasn't loaded
        setTimeout(hideLoading, 1000);
        
        // Also try to hide loading when iframe starts loading content
        if (frame) {
          // Use requestAnimationFrame to detect visible content
          let checkCount = 0;
          const checkInterval = setInterval(() => {
            checkCount++;
            try {
              if (frame.contentDocument && frame.contentDocument.body && frame.contentDocument.body.children.length > 0) {
                hideLoading();
                clearInterval(checkInterval);
              }
            } catch (e) {
              // Silent - cross-origin issues expected
            }
            if (checkCount > 50) clearInterval(checkInterval); // Stop after 5 seconds
          }, 100);
          
          frame.addEventListener('load', () => {
            clearInterval(checkInterval);
            injectConsoleFilter(frame);
            hideLoading();
          }, true); // Use capture phase to catch all load events
        }

        // Build WebSocket URL from provided iframe URL so host/port match
        if (frame) {
          try {
            const parsed = new URL('${url}');
            const wsProto = parsed.protocol === 'https:' ? 'wss' : 'ws';
            const wsUrl = wsProto + '://' + parsed.hostname + ':' + parsed.port;
            console.log('Connecting to WebSocket server at', wsUrl);
            const ws = new WebSocket(wsUrl);

            let lastReloadTime = 0;
            let connectionAttempts = 0;
            const maxRetries = 3;

            ws.onopen = () => {
              console.log('WebSocket connected');
              connectionAttempts = 0;
            };

            ws.onmessage = () => {
              const now = Date.now();
              if (now - lastReloadTime < 100) return;
              lastReloadTime = now;
              try {
                frame.contentWindow.location.reload(true);
              } catch (e) {
                frame.src = '${url}?' + now;
              }
            };

            ws.onerror = (event) => {
              console.warn('WebSocket error:', event);
            };

            ws.onclose = () => {
              console.log('WebSocket closed');
              // Auto-reconnect with exponential backoff
              if (connectionAttempts < maxRetries) {
                connectionAttempts++;
                setTimeout(() => {
                  window.location.reload();
                }, Math.pow(2, connectionAttempts) * 1000);
              }
            };
          } catch (e) {
            console.warn('Failed to create WebSocket connection for live reload:', e);
          }

          window.addEventListener('resize', () => {
            frame.style.height = window.innerHeight + 'px';
          });
        }

  // QR modal elements
  const qrModal = document.getElementById('qrModal');
  const qrClose = document.getElementById('qrClose');
  const qrCanvas = document.getElementById('qrCanvas');

        // Handle messages from extension
        window.addEventListener('message', event => {
          try {
            console.log('WebView received message:', event.data);
            const msg = event.data || {};
            if (msg.type === 'toggle-qr' && qrModal && qrCanvas) {
              const qrUrl = msg.url || '${url}';
              console.log('Showing QR modal with URL:', qrUrl);
              qrModal.classList.add('show');
              // Clear previous QR code
              qrCanvas.innerHTML = '';

              // Wait a bit for QRCode library to be ready
              const generateQR = () => {
                try {
                  if (typeof window.QRCode !== 'undefined') {
                    console.log('Generating QR code...');
                    // QRCode expects an element or id
                    new window.QRCode(qrCanvas, { text: qrUrl, width: 200, height: 200 });
                    console.log('QR code generated successfully');
                    try {
                      if (vscode && typeof vscode.postMessage === 'function') {
                        vscode.postMessage({ type: 'qr-shown' });
                      }
                    } catch (e) {
                      console.warn('Failed to post qr-shown message', e);
                    }
                  } else {
                    console.warn('QRCode library not loaded, retrying...');
                    setTimeout(generateQR, 100);
                  }
                } catch (e) {
                  console.warn('Failed to generate QR code:', e);
                }
              };
              generateQR();
            }
          } catch (e) {
            console.warn('Error handling message in webview:', e);
          }
        });

        if (qrClose && qrModal) {
          qrClose.addEventListener('click', () => {
            qrModal.classList.remove('show');
          });

          qrModal.addEventListener('click', (e) => {
            if (e.target === qrModal) qrModal.classList.remove('show');
          });
        }
        // Notify extension that the webview script is ready to receive messages
        try {
          if (vscode && typeof vscode.postMessage === 'function') {
            vscode.postMessage({ type: 'webview-ready' });
          }
        } catch (e) {
          console.warn('Failed to post webview-ready message', e);
        }
      </script>
    </body>
    </html>
  `;
}

export function deactivate() {
  if (stopServer) stopServer();
  if (webviewPanel) webviewPanel.dispose();
}

// Generate a standalone webview HTML that displays a QR code and basic actions
function getQrWebviewContent(qrUrl: string, detectedIP: string, scanToAccessText: string, qrNetworkOnlyText: string, title: string): string {
  return `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <style>
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; background: #1e1e1e; color:#fff; display:flex; align-items:center; justify-content:center; height:100vh; }
        .card { background: #fff; color:#111; padding:20px; border-radius:8px; width:320px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); text-align:center; }
        .card h2 { margin: 0 0 8px 0; font-size:18px; }
        #qrCanvas { margin: 10px auto; }
        .meta { font-size:12px; color:#666; margin-top:8px; }
        button { margin:6px 4px; padding:8px 10px; border-radius:6px; border: none; background:#007acc; color:#fff; cursor:pointer; }
        button.secondary { background:#e1e1e1; color:#111; }
        a.link { display:inline-block; margin-top:8px; color:#007acc; text-decoration:none; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>${title}</h2>
        <div id="qrCanvas"></div>
        <div class="meta">${scanToAccessText}</div>
        <div class="meta">${qrNetworkOnlyText} — IP: <strong>${detectedIP}</strong></div>
        <div style="margin-top:10px">
          <button id="openBtn">Open in browser</button>
          <button class="secondary" id="copyBtn">Copy URL</button>
        </div>
  <a class="link" href="${qrUrl}" target="_blank" rel="noreferrer">or open this link</a>
      </div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      <script>
        const vscode = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : undefined;
  const url = "${qrUrl}";

        function generate() {
          try {
            if (typeof window.QRCode !== 'undefined') {
              new window.QRCode(document.getElementById('qrCanvas'), { text: url, width: 200, height: 200 });
            } else {
              setTimeout(generate, 100);
            }
          } catch (e) {
            console.warn('Failed to generate QR', e);
          }
        }

        window.addEventListener('load', () => {
          generate();
          const openBtn = document.getElementById('openBtn');
          const copyBtn = document.getElementById('copyBtn');
          if (openBtn) openBtn.addEventListener('click', () => {
            try { window.open(url, '_blank'); } catch (e) { if (vscode && vscode.postMessage) vscode.postMessage({ type: 'open-url', url }); }
          });
          if (copyBtn) copyBtn.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(url); alert('URL copied to clipboard'); } catch (e) { try { if (vscode && vscode.postMessage) vscode.postMessage({ type: 'copy-url', url }); } catch (e) {} }
          });
          // Intercept link clicks to open externally via extension
          const links = document.querySelectorAll('a.link');
          links.forEach(a => {
              a.addEventListener('click', (ev) => {
                try {
                  ev.preventDefault();
                  const href = a.href;
                  if (vscode && vscode.postMessage) {
                    vscode.postMessage({ type: 'open-url', url: href });
                  } else {
                    window.open(href, '_blank');
                  }
                } catch (e) {}
              });
            });
        });
      </script>
    </body>
    </html>
  `;
}
