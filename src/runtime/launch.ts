import * as path from "path";
import { mirror } from "./mirror";
import { Launch, Running } from "../core/types";
import { freePort, localTarget } from "../core/network";
import { gateway, GatewayOptions } from "../server/gateway";
import { managedProcess, assertAvailable } from "./process";
export interface RuntimeOptions extends Omit<
  GatewayOptions,
  "root" | "port" | "host"
> {
  nativeHmr?: boolean;
  signal?: AbortSignal;
  php: string;
  packageManager: string;
}
export async function launch(
  spec: Launch,
  options: RuntimeOptions,
): Promise<Running> {
  let shadow: Awaited<ReturnType<typeof mirror>> | undefined;
  let processHandle: ReturnType<typeof managedProcess> | undefined;
  let upstream: URL | undefined;
  try {
    if (spec.instant && ["php", "framework"].includes(spec.mode)) {
      shadow = await mirror(spec.workspace, options.log, spec.mode !== "php", {
        signal: options.signal,
      });
      spec = {
        ...spec,
        root: path.resolve(
          shadow.root,
          path.relative(spec.workspace, spec.root),
        ),
        workspace: shadow.root,
      };
    }
    if (spec.mode === "external") upstream = localTarget(spec.upstream!);
    if (spec.mode === "php") {
      const port = await freePort();
      upstream = new URL("http://127.0.0.1:" + port);
      processHandle = managedProcess(
        options.php,
        [
          "-S",
          "127.0.0.1:" + port,
          "-t",
          spec.root,
          path.join(options.media, "router.php"),
        ],
        spec.root,
        options.log,
        { LIVE_SERVER_SE_ROOT: spec.root },
      );
      await processHandle.ready(upstream, options.signal);
    }
    if (spec.mode === "framework") {
      upstream = localTarget(spec.upstream!);
      await assertAvailable(upstream);
      const manager = options.packageManager;
      const executable =
        process.platform === "win32" ? manager + ".cmd" : manager;
      // Windows npm wrappers require cmd.exe; quote validated manager and script, never workspace shell text.
      if (
        !["npm", "pnpm", "yarn", "bun"].includes(manager) ||
        !spec.script ||
        !/^[a-zA-Z0-9:_-]+$/.test(spec.script)
      )
        throw new Error("Invalid package manager or script name.");
      processHandle =
        process.platform === "win32"
          ? managedProcess(
              "cmd.exe",
              ["/d", "/s", "/c", `"${executable} run ${spec.script}"`],
              spec.workspace,
              options.log,
            )
          : managedProcess(
              executable,
              ["run", spec.script],
              spec.workspace,
              options.log,
            );
      await processHandle.ready(upstream, options.signal);
    }
    if (options.signal?.aborted) throw new Error("Startup cancelled");
    const server = await gateway({
      ...options,
      root: spec.root,
      port: spec.port,
      host: spec.host,
      upstream,
      protectFiles: spec.mode === "php",
      watchFiles: spec.mode !== "framework" || options.nativeHmr === false,
    });
    return {
      url: server.url,
      reload: server.reload,
      update: shadow?.update,
      close: async () => {
        await server.close();
        await processHandle?.close();
        await shadow?.close();
      },
    };
  } catch (error) {
    await processHandle?.close();
    await shadow?.close();
    throw error;
  }
}
