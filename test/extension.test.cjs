const { test } = require("node:test");
const assert = require("node:assert/strict");
test("activation registers every contributed command with a clean initial lifecycle", () => {
  const Module = require("node:module");
  const original = Module._load;
  const commands = new Map();
  const disposables = [];
  const item = () => ({ show() {}, hide() {}, dispose() {}, text: "" });
  const disposable = () => ({ dispose() {} });
  const vscode = {
    StatusBarAlignment: { Left: 1 },
    window: {
      createOutputChannel: () => ({ appendLine() {}, show() {}, dispose() {} }),
      createStatusBarItem: item,
    },
    commands: {
      registerCommand: (id, fn) => {
        commands.set(id, fn);
        return disposable();
      },
    },
    workspace: {
      getConfiguration: () => ({ get: (_key, fallback) => fallback }),
      onDidChangeConfiguration: disposable,
      onDidSaveTextDocument: disposable,
      onDidChangeTextDocument: disposable,
    },
    env: { language: "en" },
  };
  Module._load = function (id, ...args) {
    return id === "vscode" ? vscode : original.call(this, id, ...args);
  };
  try {
    const extension = require("../dist/extension");
    extension.activate({
      subscriptions: disposables,
      workspaceState: { get: () => undefined },
    });
    const manifest = require("../package.json");
    for (const command of manifest.contributes.commands)
      assert.ok(commands.has(command.command), command.command);
    for (const d of disposables) d.dispose();
  } finally {
    Module._load = original;
  }
});
