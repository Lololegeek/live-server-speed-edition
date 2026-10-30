import * as vscode from "vscode";
import { Launch, Running } from "./types";
import { launch } from "../runtime/launch";
import { config } from "./config";
import { Preview } from "../ui/preview";
import { entryUrl } from "./paths";
import { t } from "../ui/i18n";
export class Controller implements vscode.Disposable {
  private startup?: AbortController;
  private editTimer?: NodeJS.Timeout;
  private running?: Running;
  private spec?: Launch;
  private busy = false;
  readonly preview = new Preview();
  readonly output = vscode.window.createOutputChannel(
    "Live Server Speed Edition",
  );
  readonly status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  readonly qr = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    99,
  );
  constructor(private context: vscode.ExtensionContext) {
    this.status.command = "fast-http-server.toggleServer";
    this.qr.command = "fast-http-server.showQr";
    this.qr.text = "$(qr-code)";
    this.qr.tooltip = "QR code";
    this.render();
  }
  log = (message: string) =>
    this.output.appendLine(new Date().toLocaleTimeString() + " " + message);
  get active() {
    return Boolean(this.running);
  }
  get last() {
    return this.spec || this.context.workspaceState.get<Launch>("lastLaunch");
  }
  render() {
    this.status.text = this.busy
      ? "$(loading~spin) Live Server SE"
      : this.active
        ? t("stop")
        : t("start");
    this.status.tooltip = this.running?.url || "Live Server Speed Edition";
    this.status.show();
    if (this.active) this.qr.show();
    else this.qr.hide();
  }
  async start(spec: Launch) {
    if (this.busy) return;
    this.busy = true;
    this.render();
    try {
      if (!vscode.workspace.isTrusted)
        throw new Error(
          "Trust this workspace before running a preview or project script.",
        );
      await this.stop();
      this.spec = spec;
      this.startup = new AbortController();
      this.running = await launch(spec, {
        ...config(spec, this.context, this.log),
        signal: this.startup.signal,
      });
      if (this.startup.signal.aborted) throw new Error("Startup cancelled");
      if (spec.instant && this.running.update)
        for (const doc of vscode.workspace.textDocuments)
          if (doc.isDirty)
            await this.running.update(doc.uri.fsPath, doc.getText());
      await this.context.workspaceState.update("lastLaunch", spec);
      this.log("Ready: " + this.running.url);
      await this.preview.open(this.running.url, spec);
    } catch (error) {
      await this.stop();
      this.log(String(error));
      this.output.show(true);
      throw error;
    } finally {
      this.busy = false;
      this.render();
    }
  }
  async stop() {
    this.startup?.abort();
    if (this.editTimer) clearTimeout(this.editTimer);
    const running = this.running;
    this.running = undefined;
    this.preview.dispose();
    if (running) await running.close();
    this.render();
  }
  async reopen() {
    if (this.running && this.spec)
      await this.preview.open(this.running.url, {
        ...this.spec,
        preview: "webview",
      });
  }
  async showQr() {
    if (!this.running || !this.spec) return;
    if (this.spec.host === "127.0.0.1" || this.spec.host === "localhost") {
      vscode.window.showInformationMessage(
        "Restart with Local network access to use this URL on your phone.",
      );
      return;
    }
    await this.preview.qr(entryUrl(this.running.url, this.spec.entry));
  }
  async copy() {
    if (this.running && this.spec)
      await vscode.env.clipboard.writeText(
        entryUrl(this.running.url, this.spec.entry),
      );
  }
  changed(file: string, content?: string) {
    if (!this.spec?.instant) return;
    if (this.running?.update) void this.running.update(file, content);
    else {
      if (this.editTimer) clearTimeout(this.editTimer);
      this.editTimer = setTimeout(() => this.running?.reload?.([file]), 75);
    }
  }
  dispose() {
    void this.stop();
    this.status.dispose();
    this.qr.dispose();
    this.output.dispose();
  }
}
