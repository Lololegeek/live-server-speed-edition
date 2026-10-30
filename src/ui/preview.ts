import * as vscode from "vscode";
import QRCode from "qrcode";
import { Launch } from "../core/types";
import { entryUrl } from "../core/paths";
export class Preview implements vscode.Disposable {
  private panel?: vscode.WebviewPanel;
  async open(base: string, spec: Launch) {
    const url = entryUrl(base, spec.entry);
    if (spec.preview === "browser") {
      await vscode.env.openExternal(vscode.Uri.parse(url));
      return;
    }
    const external = await vscode.env.asExternalUri(vscode.Uri.parse(url));
    this.panel?.dispose();
    const panel = vscode.window.createWebviewPanel(
      "liveServerSE",
      "Live Server SE",
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    this.panel = panel;
    const nonce = require("crypto").randomBytes(16).toString("hex");
    const escaped = external
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
    const origin = new URL(external.toString()).origin;
    panel.webview.html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${origin}; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';"><style>html,body,iframe{width:100%;height:100%;border:0;margin:0;background:var(--vscode-editor-background)}#download{display:none;position:fixed;inset:15% 10%;padding:24px;background:var(--vscode-editor-background);color:var(--vscode-foreground);border:1px solid var(--vscode-focusBorder);font-family:var(--vscode-font-family)}button{padding:8px}</style></head><body><iframe id="frame" title="Live Server preview" src="${escaped}" allow="clipboard-read; clipboard-write"></iframe><section id="download"><h2>File information</h2><p id="name"></p><p id="size"></p><p id="type"></p><p>Preview only — file content was not downloaded.</p><button id="close">Close</button></section><script nonce="${nonce}">const frame=document.getElementById('frame');window.addEventListener('message',event=>{if(event.source!==frame.contentWindow||event.origin!==new URL(frame.src).origin||event.data?.type!=='live-server-se-download')return;const file=event.data;document.getElementById('name').textContent='Name: '+String(file.name).slice(0,512);document.getElementById('size').textContent='Size: '+(Number.isFinite(file.size)?new Intl.NumberFormat().format(file.size)+' bytes':'unknown');document.getElementById('type').textContent='Type: '+String(file.mime||'unknown').slice(0,256);document.getElementById('download').style.display='block';});document.getElementById('close').onclick=()=>document.getElementById('download').style.display='none';</script></body></html>`;
    panel.onDidDispose(() => {
      if (this.panel === panel) this.panel = undefined;
    });
  }
  async qr(url: string) {
    const data = await QRCode.toDataURL(url, { width: 280, margin: 2 });
    const panel = vscode.window.createWebviewPanel(
      "liveServerQR",
      "Live Server SE — QR",
      vscode.ViewColumn.Beside,
      {},
    );
    const safe = url
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
    panel.webview.html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline';"><style>body{text-align:center;color:var(--vscode-foreground);background:var(--vscode-editor-background);font-family:var(--vscode-font-family);padding:24px}img{max-width:100%}p{overflow-wrap:anywhere}</style></head><body><h2>Live Server SE</h2><img alt="QR code" src="${data}"><p>${safe}</p></body></html>`;
  }
  dispose() {
    this.panel?.dispose();
    this.panel = undefined;
  }
}
