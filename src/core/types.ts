export type Mode = "static" | "php" | "framework" | "external";
export interface Launch {
  workspace: string;
  root: string;
  entry: string;
  mode: Mode;
  port: number;
  host: string;
  https: boolean;
  preview: "browser" | "webview";
  script?: string;
  upstream?: string;
  instant?: boolean;
}
export interface Running {
  url: string;
  close(): Promise<void>;
  reload?(paths: string[]): void;
  update?(file: string, content?: string): Promise<void>;
}
export type Logger = (message: string) => void;
