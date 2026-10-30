import * as path from "path";
import * as fs from "fs";
export function inside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return (
    rel === "" ||
    (rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel))
  );
}
export function safePath(root: string, request: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(request.split("?")[0]);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return null;
  const parts = decoded.split("/");
  if (
    parts.some(
      (p) => p.startsWith(".") || ["node_modules", "vendor"].includes(p),
    )
  )
    return null;
  const candidate = path.resolve(
    root,
    "." + (decoded.startsWith("/") ? decoded : "/" + decoded),
  );
  if (!inside(root, candidate)) return null;
  // Resolve the nearest existing ancestor too: missing paths beneath an external symlink are forbidden.
  let ancestor = candidate;
  while (!fs.existsSync(ancestor) && path.dirname(ancestor) !== ancestor)
    ancestor = path.dirname(ancestor);
  try {
    if (!inside(fs.realpathSync(root), fs.realpathSync(ancestor))) return null;
  } catch {
    return null;
  }
  return candidate;
}
export function entryUrl(base: string, entry: string): string {
  const url = new URL(base);
  url.pathname = "/" + entry.split(/[\\/]/).map(encodeURIComponent).join("/");
  return url.href;
}
