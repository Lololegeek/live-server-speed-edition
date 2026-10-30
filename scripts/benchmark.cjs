// Reproducible synthetic workload; reports observations, not a universal latency promise.
const fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os");
const { performance } = require("node:perf_hooks");
const { mirror } = require("../dist/runtime/mirror");
(async () => {
  const source = await fs.mkdtemp(path.join(os.tmpdir(), "se-bench-"));
  let copy;
  const original = fs.writeFile;
  let writes = 0;
  try {
    await fs.mkdir(path.join(source, "src"));
    for (let i = 0; i < 1000; i++)
      await fs.writeFile(
        path.join(source, "src", i + ".txt"),
        "x".repeat(1024),
      );
    const file = path.join(source, "index.php");
    await fs.writeFile(file, "original");
    const start = performance.now();
    copy = await mirror(source, () => {});
    const copyMs = performance.now() - start;
    fs.writeFile = async function (target, ...args) {
      if (target === path.join(copy.root, "index.php")) writes++;
      return original.call(this, target, ...args);
    };
    const editing = performance.now();
    await Promise.all(
      Array.from({ length: 200 }, (_, i) => copy.update(file, "buffer " + i)),
    );
    await copy.update(file, "buffer 199");
    console.log(
      JSON.stringify(
        {
          node: process.version,
          platform: process.platform,
          files: 1001,
          copyMs: Number(copyMs.toFixed(1)),
          bufferUpdates: 201,
          actualBufferWrites: writes,
          editBatchMs: Number((performance.now() - editing).toFixed(1)),
          originalUnchanged: (await fs.readFile(file, "utf8")) === "original",
        },
        null,
        2,
      ),
    );
  } finally {
    fs.writeFile = original;
    if (copy) await copy.close();
    await fs.rm(source, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
