import * as vscode from "vscode";
import en from "./locales/wizard/en";
import fr from "./locales/wizard/fr";
import es from "./locales/wizard/es";
import de from "./locales/wizard/de";
import it from "./locales/wizard/it";
import pt from "./locales/wizard/pt";
import ja from "./locales/wizard/ja";
import zh from "./locales/wizard/zh";
import ko from "./locales/wizard/ko";
import ru from "./locales/wizard/ru";
const locales: Record<string, string[]> = {
  en,
  fr,
  es,
  de,
  it,
  pt,
  ja,
  zh,
  ko,
  ru,
};
export function wizardText(index: number) {
  const language = vscode.workspace
    .getConfiguration("liveServerSpeed")
    .get<string>("language", "auto");
  const code = (language === "auto" ? vscode.env.language : language)
    .toLowerCase()
    .split(/[-_]/)[0];
  return (locales[code] || en)[index];
}
