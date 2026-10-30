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

test("session manager keeps independent launches and broadcasts edits and shutdown", async () => {
  const Module = require("node:module"),
    original = Module._load,
    instances = [];
  class Fake {
    constructor() {
      instances.push(this);
      this.active = false;
      this.starting = false;
      this.output = {};
    }
    setVisible(value) {
      this.visible = value;
    }
    render() {}
    log() {}
    async start(spec) {
      this.last = spec;
      this.active = true;
    }
    async stop() {
      this.active = false;
    }
    changed(file, content) {
      this.edit = { file, content };
    }
    dispose() {}
  }
  Module._load = function (id, ...args) {
    return id === "../core/controller"
      ? { Controller: Fake }
      : id === "vscode"
        ? {}
        : original.call(this, id, ...args);
  };
  try {
    delete require.cache[require.resolve("../dist/sessions/manager")];
    const { SessionManager } = require("../dist/sessions/manager");
    const manager = new SessionManager({});
    await manager.start({ workspace: "/project", port: 5500, mode: "static" });
    await manager.start({ workspace: "/project", port: 5501, mode: "php" });
    assert.equal(instances.length, 2);
    assert.ok(instances.every((s) => s.active));
    assert.equal(instances[0].visible, false);
    assert.equal(instances[1].visible, true);
    manager.changed("/project/index.html", "new");
    assert.ok(instances.every((s) => s.edit.content === "new"));
    await manager.start({ workspace: "/project", port: 5500, mode: "static" });
    assert.equal(instances.length, 2);
    await manager.stopAll();
    assert.ok(instances.every((s) => !s.active));
  } finally {
    Module._load = original;
  }
});
