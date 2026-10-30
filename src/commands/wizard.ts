import * as vscode from "vscode";
export const Back = Symbol("back");
export function input(
  prompt: string,
  value: string,
  validate?: (value: string) => string | undefined,
): Promise<string | typeof Back | undefined> {
  return new Promise((resolve) => {
    const box = vscode.window.createInputBox();
    const listeners: vscode.Disposable[] = [];
    let settled = false;
    const finish = (result: string | typeof Back | undefined) => {
      if (settled) return;
      settled = true;
      listeners.forEach((l) => l.dispose());
      box.dispose();
      resolve(result);
    };
    box.title = "Live Server SE";
    box.prompt = prompt;
    box.value = value;
    box.buttons = [vscode.QuickInputButtons.Back];
    listeners.push(
      box.onDidTriggerButton(() => finish(Back)),
      box.onDidHide(() => finish(undefined)),
      box.onDidChangeValue((value) => {
        box.validationMessage = validate?.(value);
      }),
      box.onDidAccept(() => {
        const error = validate?.(box.value);
        box.validationMessage = error;
        if (!error) finish(box.value);
      }),
    );
    box.show();
  });
}
export function pick(
  title: string,
  labels: string[],
  selected: number,
): Promise<number | typeof Back | undefined> {
  return new Promise((resolve) => {
    const box = vscode.window.createQuickPick<
      vscode.QuickPickItem & { index: number }
    >();
    const listeners: vscode.Disposable[] = [];
    let settled = false;
    const finish = (value: number | typeof Back | undefined) => {
      if (settled) return;
      settled = true;
      listeners.forEach((l) => l.dispose());
      box.dispose();
      resolve(value);
    };
    box.title = title;
    box.items = labels.map((label, index) => ({ label, index }));
    box.activeItems = [box.items[selected] || box.items[0]];
    box.buttons = [vscode.QuickInputButtons.Back];
    listeners.push(
      box.onDidTriggerButton(() => finish(Back)),
      box.onDidHide(() => finish(undefined)),
      box.onDidAccept(() => {
        if (box.selectedItems[0]) finish(box.selectedItems[0].index);
      }),
    );
    box.show();
  });
}
