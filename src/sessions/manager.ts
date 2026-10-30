import * as vscode from "vscode";
import { Controller } from "../core/controller";
import { Launch } from "../core/types";
export class SessionManager implements vscode.Disposable {
  private sessions: Controller[];
  private selected: Controller;
  constructor(private context: vscode.ExtensionContext) {
    this.selected = new Controller(context);
    this.sessions = [this.selected];
  }
  get active() {
    return this.selected.active;
  }
  get starting() {
    return this.selected.starting;
  }
  get last() {
    return this.selected.last;
  }
  get output() {
    return this.selected.output;
  }
  log = (message: string) => this.selected.log(message);
  async start(spec: Launch) {
    const existing = this.sessions.find(
      (s) =>
        s.last?.workspace === spec.workspace &&
        s.last?.port === spec.port &&
        s.last?.mode === spec.mode,
    );
    const target =
      existing ||
      (!this.selected.active && !this.selected.starting
        ? this.selected
        : new Controller(this.context, false));
    if (!this.sessions.includes(target)) this.sessions.push(target);
    this.select(target);
    await target.start(spec);
  }
  private select(target: Controller) {
    for (const s of this.sessions) s.setVisible(s === target);
    this.selected = target;
  }
  async manage() {
    const pick = await vscode.window.showQuickPick(
      this.sessions.map((s, index) => ({
        label: `${s.active ? "$(radio-tower)" : "$(circle-outline)"} ${index + 1}: ${s.last?.mode || "Server"}`,
        description: s.last ? `${s.last.workspace} • ${s.last.port}` : "",
        session: s,
      })),
      { placeHolder: "Select a server session" },
    );
    if (!pick) return;
    this.select(pick.session);
    const action = await vscode.window.showQuickPick([
      "Open preview",
      "Show logs",
      "Stop",
      "Restart",
      "Copy URL",
    ]);
    if (action === "Open preview") await this.reopen();
    if (action === "Show logs") this.output.show(true);
    if (action === "Stop") await this.stop();
    if (action === "Restart" && this.last) await this.selected.start(this.last);
    if (action === "Copy URL") await this.copy();
  }
  stop() {
    return this.selected.stop();
  }
  async stopAll() {
    await Promise.all(this.sessions.map((s) => s.stop()));
  }
  reopen() {
    return this.selected.reopen();
  }
  showQr() {
    return this.selected.showQr();
  }
  copy() {
    return this.selected.copy();
  }
  render() {
    this.sessions.forEach((s) => s.render());
  }
  changed(file: string, content?: string) {
    this.sessions.forEach((s) => s.changed(file, content));
  }
  dispose() {
    this.sessions.forEach((s) => s.dispose());
  }
}
