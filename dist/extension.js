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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const server_1 = require("./server");
const open_1 = __importDefault(require("open"));
let stopServer = null;
let webviewPanel = null;
let statusButton;
function activate(context) {
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
            const choice = await vscode.window.showQuickPick(['Open in default browser', 'Open in VS Code WebView'], { placeHolder: 'How do you want to open the server?' });
            stopServer = (0, server_1.startServer)(folder, port, async (url) => {
                if (choice === 'Open in default browser') {
                    (0, open_1.default)(url);
                }
                else if (choice === 'Open in VS Code WebView') {
                    if (webviewPanel) {
                        webviewPanel.reveal(vscode.ViewColumn.Two);
                    }
                    else {
                        webviewPanel = vscode.window.createWebviewPanel('fastHttpWebview', 'Fast HTTP Server', vscode.ViewColumn.Two, { enableScripts: true });
                        webviewPanel.webview.html = `<iframe src="${url}" style="width:100%;height:100%;border:none;"></iframe>`;
                        webviewPanel.onDidDispose(() => (webviewPanel = null));
                    }
                }
            });
            // Met à jour le bouton
            statusButton.text = '$(debug-disconnect) Stop Fast HTTP';
            statusButton.tooltip = 'Stop Fast HTTP Server';
        }
        else {
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
function deactivate() {
    if (stopServer)
        stopServer();
    if (webviewPanel)
        webviewPanel.dispose();
}
//# sourceMappingURL=extension.js.map