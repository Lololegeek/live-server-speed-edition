import * as vscode from "vscode";
import * as fs from "fs";
import { Launch } from "../core/types";
export class Profiles {
  constructor(private state: vscode.Memento) {}
  private get entries() {
    return this.state.get<Record<string, Launch>>("launchProfiles", {});
  }
  async save(spec?: Launch) {
    if (!spec)
      throw new Error("Configure or launch a server before saving a profile.");
    const name = await vscode.window.showInputBox({
      prompt: "Profile name",
      validateInput: (v) => (v.trim() ? undefined : "Enter a name"),
    });
    if (!name) return;
    const entries = this.entries;
    Object.defineProperty(entries, name.trim(), {
      value: { ...spec },
      enumerable: true,
      configurable: true,
      writable: true,
    });
    await this.state.update("launchProfiles", entries);
  }
  async pick(remove = false): Promise<Launch | undefined> {
    const entries = this.entries;
    const name = await vscode.window.showQuickPick(Object.keys(entries), {
      placeHolder: remove ? "Delete profile" : "Launch profile",
    });
    if (!name) return;
    if (remove) {
      delete entries[name];
      await this.state.update("launchProfiles", entries);
      return;
    }
    const spec = entries[name];
    if (!fs.existsSync(spec.workspace) || !fs.existsSync(spec.root))
      throw new Error("Profile folder no longer exists.");
    return { ...spec };
  }
}
