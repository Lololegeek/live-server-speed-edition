import { spawn, ChildProcess } from "child_process";
import * as net from "net";
import * as http from "http";
import * as https from "https";
export function managedProcess(
  command: string,
  args: string[],
  cwd: string,
  log: (m: string) => void,
  env: NodeJS.ProcessEnv = {},
): {
  ready: (url: URL, signal?: AbortSignal) => Promise<void>;
  close: () => Promise<void>;
} {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    shell: false,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  let failure: Error | undefined;
  child.on("error", (error) => {
    failure = error;
    log(String(error));
  });
  child.on("exit", (code, signal) => {
    failure = new Error(`Process exited (${code ?? signal})`);
    log(String(failure));
  });
  child.stdout?.on("data", (data) => log(String(data).trimEnd()));
  child.stderr?.on("data", (data) => log(String(data).trimEnd()));
  let closed = false;
  return {
    ready: async (url, signal) => {
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        if (signal?.aborted) throw new Error("Startup cancelled");
        if (failure) throw failure;
        const ok = await new Promise<boolean>((resolve) => {
          const req = (url.protocol === "https:" ? https : http).get(
            url,
            (res) => {
              res.resume();
              resolve(true);
            },
          );
          req.on("error", () => resolve(false));
          req.setTimeout(500, () => {
            req.destroy();
            resolve(false);
          });
        });
        if (ok) return;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      throw new Error(
        "Development server did not become ready within 60 seconds. Check logs and upstream URL.",
      );
    },
    close: async () => {
      if (closed) return;
      closed = true;
      if (!child.pid || child.exitCode !== null || child.signalCode !== null)
        return;
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          try {
            if (process.platform === "win32") child.kill();
            else process.kill(-child.pid!, "SIGKILL");
          } catch {}
          resolve();
        }, 3000);
        child.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
        if (process.platform === "win32") {
          const killer = spawn("taskkill", [
            "/pid",
            String(child.pid),
            "/T",
            "/F",
          ]);
          killer.on("error", () => child.kill());
        } else {
          try {
            process.kill(-child.pid!, "SIGTERM");
          } catch {
            resolve();
            clearTimeout(timeout);
          }
        }
      });
    },
  };
}

export async function assertAvailable(url: URL): Promise<void> {
  const busy = await new Promise<boolean>((resolve) => {
    const socket = net.connect(
      Number(url.port || (url.protocol === "https:" ? 443 : 80)),
      url.hostname.replace(/^\[|\]$/g, ""),
    );
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
  if (busy)
    throw new Error(
      "Upstream port is already occupied. Use Attach existing localhost server, or stop the old process.",
    );
}
