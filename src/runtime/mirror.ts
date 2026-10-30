import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import chokidar from "chokidar";
import { inside } from "../core/paths";
import { CoalescingQueue } from "../core/coalescingQueue";

export async function mirror(
  root: string,
  log: (m: string) => void,
  shareVendor = true,
  options: { signal?: AbortSignal; delay?: number } = {},
) {
  const temporary = await fs.promises.mkdtemp(
    path.join(fs.realpathSync.native(os.tmpdir()), "live-server-se-"),
  );
  const destination = path.join(temporary, "project");
  const dirty = new Map<string, string>(),
    written = new Map<string, string>();
  const queue = new CoalescingQueue(options.delay ?? 25);
  let closed = false;
  const excluded = new Set([".git", ".next", ".nuxt", ".svelte-kit"]);
  // Bounded batches avoid both sequential copy latency and thousands of open file operations.
  async function copy(source: string, target: string): Promise<void> {
    const tasks = [{ source, target }];
    let cursor = 0;
    while (cursor < tasks.length) {
      if (options.signal?.aborted) throw new Error("Startup cancelled");
      const batch = tasks.slice(cursor, cursor + 16);
      cursor += batch.length;
      const results = await Promise.allSettled(
        batch.map(async (task) => {
          const name = path.basename(task.source);
          if (
            task.source !== root &&
            (name === "node_modules" || (name === "vendor" && shareVendor))
          ) {
            if (!fs.existsSync(task.target))
              await fs.promises.symlink(
                task.source,
                task.target,
                process.platform === "win32" ? "junction" : "dir",
              );
            return;
          }
          const stat = await fs.promises.lstat(task.source);
          if (stat.isSymbolicLink()) {
            log("Skipped project symlink in live editing copy: " + task.source);
            return;
          }
          if (stat.isDirectory()) {
            await fs.promises.mkdir(task.target, { recursive: true });
            for (const entry of await fs.promises.readdir(task.source)) {
              if (!excluded.has(entry))
                tasks.push({
                  source: path.join(task.source, entry),
                  target: path.join(task.target, entry),
                });
            }
          } else if (stat.isFile())
            await fs.promises.copyFile(
              task.source,
              task.target,
              fs.constants.COPYFILE_FICLONE,
            );
        }),
      );
      const failure = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      if (failure) throw failure.reason;
    }
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
  const update = (file: string, content?: string): Promise<void> => {
    if (
      closed ||
      !inside(root, file) ||
      path
        .relative(root, file)
        .split(path.sep)
        .some((p) => ["node_modules", "vendor", ".git"].includes(p))
    )
      return Promise.resolve();
    if (content !== undefined) dirty.set(file, content);
    else dirty.delete(file);
    return queue
      .enqueue(file, async () => {
        const target = path.join(destination, path.relative(root, file));
        if (content !== undefined) {
          if (written.get(file) === content) return;
          await fs.promises.mkdir(path.dirname(target), { recursive: true });
          await fs.promises.writeFile(target, content);
          written.set(file, content);
        } else {
          written.delete(file);
          if (fs.existsSync(file)) await copy(file, target);
          else await fs.promises.rm(target, { recursive: true, force: true });
        }
      })
      .catch((error) => log("Live editing copy: " + error));
  };
  watcher.on("all", (_event, file) => {
    void update(file, dirty.get(file));
  });
  watcher.on("error", (error) => log(String(error)));
  return {
    root: destination,
    update,
    close: async () => {
      if (closed) return;
      closed = true;
      await watcher.close();
      await queue.flush();
      await fs.promises.rm(temporary, { recursive: true, force: true });
    },
  };
}
