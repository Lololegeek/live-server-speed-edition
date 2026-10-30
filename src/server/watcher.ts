import chokidar from "chokidar";
import * as path from "path";
export function watch(
  root: string,
  options: {
    debounce: number;
    polling: boolean;
    ignored: string[];
    extensions: string[];
  },
  notify: (paths: string[]) => void,
  log: (m: string) => void,
): () => Promise<void> {
  const extensions = new Set(
    options.extensions.map((e) =>
      (e.startsWith(".") ? e : "." + e).toLowerCase(),
    ),
  );
  let timer: NodeJS.Timeout | undefined;
  const pending = new Set<string>();
  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    ignored: [
      "**/node_modules/**",
      "**/.git/**",
      "**/.vscode/**",
      "**/vendor/**",
      "**/*.tmp",
      "**/*~",
      ...options.ignored,
    ],
    usePolling: options.polling,
    interval: 100,
    awaitWriteFinish: {
      stabilityThreshold: Math.max(50, options.debounce),
      pollInterval: 25,
    },
  });
  watcher.on("error", (e) => log("Watcher: " + e));
  watcher.on("all", (_event, file) => {
    if (extensions.size && !extensions.has(path.extname(file).toLowerCase()))
      return;
    pending.add(path.relative(root, file).split(path.sep).join("/"));
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      notify([...pending]);
      pending.clear();
    }, options.debounce);
  });
  return async () => {
    if (timer) clearTimeout(timer);
    await watcher.close();
  };
}
