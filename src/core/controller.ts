import * as vscode from "vscode";
import { Launch, Running } from "./types";
import { launch } from "../runtime/launch";
import { config } from "./config";
import { Preview } from "../ui/preview";
import { inside } from "./paths";
import { entryUrl } from "./paths";
import { buttonVisibility } from "../ui/visibility";
import { t } from "../ui/i18n";
export class Controller implements vscode.Disposable {
  private startup?: AbortController;
  private editTimer?: NodeJS.Timeout;
  private editPaths = new Set<string>();
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
  readonly reopenButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    98,
  );
  readonly copyButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    97,
  );
  readonly qr = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    99,
  );
  constructor(
    private context: vscode.ExtensionContext,
    private visible = true,
  ) {
    this.status.command = "fast-http-server.toggleServer";
    this.qr.command = "fast-http-server.showQr";
    this.qr.text = "$(qr-code)";
    this.qr.tooltip = "QR code";
    this.reopenButton.command = "fast-http-server.reopenWebview";
    this.reopenButton.text = "$(window)";
    this.reopenButton.tooltip = "Reopen WebView";
    this.copyButton.command = "fast-http-server.copyUrl";
    this.copyButton.text = "$(link)";
    this.copyButton.tooltip = "Copy preview URL";
    this.render();
  }
  log = (message: string) =>
    this.output.appendLine(new Date().toLocaleTimeString() + " " + message);
  get starting() {
    return this.busy;
  }
  get active() {
    return Boolean(this.running);
  }
  get last() {
    return this.spec || this.context.workspaceState.get<Launch>("lastLaunch");
  }
  setVisible(visible: boolean) {
    this.visible = visible;
    this.render();
  }
  render() {
    this.status.text = this.busy
      ? "$(loading~spin) Live Server SE"
      : this.active
        ? t("stop")
        : t("start");
    this.status.tooltip = this.running?.url || "Live Server Speed Edition";
    const c = vscode.workspace.getConfiguration("liveServerSpeed");
    const visibility = buttonVisibility(
      {
        mode: c.get("interfaceMode", "full"),
        start: c.get("showStartButton", true),
        qr: c.get("showQrButton", true),
        reopen: c.get("showReopenButton", true),
        copy: c.get("showCopyUrlButton", false),
      },
      this.active,
    );
    for (const [name, item] of Object.entries({
      start: this.status,
      qr: this.qr,
      reopen: this.reopenButton,
      copy: this.copyButton,
    })) {
      if (this.visible && visibility[name as keyof typeof visibility])
        item.show();
      else item.hide();
    }
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
      this.running = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Live Server SE: preparing preview",
          cancellable: true,
        },
        async (progress, token) => {
          const cancel = token.onCancellationRequested(() =>
            this.startup?.abort(),
          );
          progress.report({ message: spec.mode });
          try {
            return await launch(spec, {
              ...config(spec, this.context, this.log),
              signal: this.startup!.signal,
            });
          } finally {
            cancel.dispose();
          }
        },
      );
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
    this.editPaths.clear();
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
    if (
      !this.spec?.instant ||
      !inside(this.running?.update ? this.spec.workspace : this.spec.root, file)
    )
      return;
    if (this.running?.update)
      void this.running
        .update(file, content)
        .catch((error) => this.log(String(error)));
    else {
      if (this.editTimer) clearTimeout(this.editTimer);
      this.editPaths.add(file);
      this.editTimer = setTimeout(
        () => {
          this.running?.reload?.([...this.editPaths]);
          this.editPaths.clear();
        },
        vscode.workspace
          .getConfiguration("liveServerSpeed")
          .get<number>("debounceTime", 50),
      );
    }
  }
  dispose() {
    void this.stop();
    this.status.dispose();
    this.qr.dispose();
    this.reopenButton.dispose();
    this.copyButton.dispose();
    this.output.dispose();
  }
}
