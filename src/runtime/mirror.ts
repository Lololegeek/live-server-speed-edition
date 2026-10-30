import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import chokidar from "chokidar";
import { inside } from "../core/paths";
export async function mirror(
  root: string,
  log: (m: string) => void,
  shareVendor = true,
) {
  const temporary = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "live-server-se-"),
  );
  const destination = path.join(temporary, "project");
  const dirty = new Map<string, string>();
  async function copy(source: string, target: string): Promise<void> {
    const stat = await fs.promises.lstat(source);
    if (stat.isSymbolicLink()) {
      log("Skipped project symlink in live editing copy: " + source);
      return;
    }
    if (stat.isDirectory()) {
      await fs.promises.mkdir(target, { recursive: true });
      for (const name of await fs.promises.readdir(source)) {
        if ([".git", ".next", ".nuxt", ".svelte-kit"].includes(name)) continue;
        const from = path.join(source, name),
          to = path.join(target, name);
        if (name === "node_modules" || (name === "vendor" && shareVendor)) {
          await fs.promises.symlink(
            from,
            to,
            process.platform === "win32" ? "junction" : "dir",
          );
        } else await copy(from, to);
      }
    } else if (stat.isFile()) await fs.promises.copyFile(source, target);
  }
  try {
    await copy(root, destination);
  } catch (error) {
    await fs.promises.rm(temporary, { recursive: true, force: true });
    throw error;
  }
  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    ignored: [
      "**/node_modules/**",
      "**/vendor/**",
      "**/.git/**",
      "**/.next/**",
      "**/.nuxt/**",
      "**/.svelte-kit/**",
    ],
  });
  let pending = Promise.resolve();
  const update = (file: string, content?: string) => {
    pending = pending
      .then(async () => {
        if (!inside(root, file)) return;
        const relative = path.relative(root, file);
        if (
          relative
            .split(path.sep)
            .some((p) => ["node_modules", "vendor", ".git"].includes(p))
        )
          return;
        const target = path.join(destination, relative);
        if (content !== undefined) {
          dirty.set(file, content);
          await fs.promises.mkdir(path.dirname(target), { recursive: true });
          await fs.promises.writeFile(target, content);
        } else {
          dirty.delete(file);
          if (fs.existsSync(file)) await copy(file, target);
          else await fs.promises.rm(target, { recursive: true, force: true });
        }
      })
      .catch((error) => log("Live editing copy: " + error));
    return pending;
  };
  watcher.on("all", (_event, file) => {
    void update(file, dirty.get(file));
  });
  watcher.on("error", (e) => log(String(e)));
  return {
    root: destination,
    update,
    close: async () => {
      await watcher.close();
      await pending;
      await fs.promises.rm(temporary, { recursive: true, force: true });
    },
  };
}
