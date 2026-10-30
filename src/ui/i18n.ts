import * as vscode from "vscode";
import { TRANSLATIONS } from "./translations";
export function t(key: string, fallback = key): string {
  const language = vscode.workspace
    .getConfiguration("liveServerSpeed")
    .get<string>("language", "auto");
  const code =
    language === "auto"
      ? vscode.env.language.toLowerCase().split(/[-_]/)[0]
      : language.toLowerCase().split(/[-_]/)[0];
  return TRANSLATIONS[code]?.[key] || TRANSLATIONS.en[key] || fallback;
}
