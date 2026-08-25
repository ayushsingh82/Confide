/**
 * Path-jailed file IO for sandbox sessions.
 *
 * Every sandbox is rooted at `${DATA_DIR}/sandboxes/<id>/workspace`. All paths
 * coming from the browser are resolved against this root and verified to stay
 * inside it — otherwise we 403. This is the only defense against ../../../etc/passwd
 * style escapes while the sandbox still runs on the same filesystem as the
 * backend. When the sandbox moves into a real CVM, this jail becomes
 * defense-in-depth on top of the CVM's own isolation.
 */

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { config } from "@/config.js";

const MAX_TEXT_BYTES = 2 * 1024 * 1024; // 2 MB cap on text file reads
const SKIP_DIRS = new Set([".git", "node_modules", ".next", ".venv", "dist", "build"]);

export class SandboxFsError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "SandboxFsError";
  }
}

export function sandboxRoot(sandboxId: string): string {
  return path.resolve(config.dataDir, "sandboxes", sandboxId);
}

export function workspaceRoot(sandboxId: string): string {
  return path.join(sandboxRoot(sandboxId), "workspace");
}

/** Resolve a user-supplied path under the workspace; throw if it escapes. */
export function resolveSafe(sandboxId: string, userPath: string): string {
  const root = workspaceRoot(sandboxId);
  const cleaned = userPath.replace(/^\/+/, "");
  const candidate = path.resolve(root, cleaned);
  // Append a separator so /foo doesn't match /foobar via startsWith.
  if (!(candidate + path.sep).startsWith(root + path.sep) && candidate !== root) {
    throw new SandboxFsError("Path escapes workspace", 403);
  }
  return candidate;
}

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: TreeNode[];
}

/** Recursive tree, capped depth & breadth so huge repos still render fast. */
export async function listTree(
  sandboxId: string,
  maxDepth = 5,
  maxEntries = 2000
): Promise<TreeNode> {
  const root = workspaceRoot(sandboxId);
  if (!fsSync.existsSync(root)) {
    throw new SandboxFsError("Workspace not found", 404);
  }
  let count = 0;

  async function walk(dirAbs: string, depth: number, rel: string): Promise<TreeNode> {
    const name = rel === "" ? "/" : path.basename(rel);
    const node: TreeNode = { name, path: rel || "/", type: "dir", children: [] };
    if (depth >= maxDepth || count >= maxEntries) return node;

    let entries;
    try {
      entries = await fs.readdir(dirAbs, { withFileTypes: true });
    } catch {
      return node;
    }
    // Stable alphabetical, dirs first.
    entries.sort((a, b) => {
      const aDir = a.isDirectory() ? 0 : 1;
      const bDir = b.isDirectory() ? 0 : 1;
      if (aDir !== bDir) return aDir - bDir;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      if (count >= maxEntries) break;
      if (SKIP_DIRS.has(entry.name)) continue;
      count++;
      const childRel = path.join(rel, entry.name);
      const childAbs = path.join(dirAbs, entry.name);
      if (entry.isDirectory()) {
        node.children!.push(await walk(childAbs, depth + 1, childRel));
      } else if (entry.isFile()) {
        let size = 0;
        try {
          const stat = await fs.stat(childAbs);
          size = stat.size;
        } catch {
          // ignore
        }
        node.children!.push({
          name: entry.name,
          path: childRel,
          type: "file",
          size,
        });
      }
    }
    return node;
  }

  return walk(root, 0, "");
}

export interface DirEntry {
  name: string;
  isDir: boolean;
  size: number;
}

/** Single-level directory listing — what the fs.list bridge frame returns. */
export async function listDir(sandboxId: string, userPath: string): Promise<DirEntry[]> {
  const abs = resolveSafe(sandboxId, userPath);
  let entries;
  try {
    entries = await fs.readdir(abs, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new SandboxFsError("Directory not found", 404);
    if (code === "ENOTDIR") throw new SandboxFsError("Not a directory", 400);
    throw err;
  }
  const out: DirEntry[] = [];
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.isDirectory()) {
      out.push({ name: entry.name, isDir: true, size: 0 });
    } else if (entry.isFile()) {
      let size = 0;
      try {
        size = (await fs.stat(path.join(abs, entry.name))).size;
      } catch {
        // ignore
      }
      out.push({ name: entry.name, isDir: false, size });
    }
  }
  out.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
  return out;
}

export async function readFile(
  sandboxId: string,
  userPath: string
): Promise<{ path: string; contents: string; size: number; truncated: boolean }> {
  const abs = resolveSafe(sandboxId, userPath);
  let stat;
  try {
    stat = await fs.stat(abs);
  } catch {
    throw new SandboxFsError("File not found", 404);
  }
  if (!stat.isFile()) throw new SandboxFsError("Not a file", 400);
  const truncated = stat.size > MAX_TEXT_BYTES;
  const buf = await fs.readFile(abs);
  const slice = truncated ? buf.subarray(0, MAX_TEXT_BYTES) : buf;
  // Reject obviously-binary content so the editor doesn't show garbage.
  for (let i = 0; i < Math.min(slice.length, 512); i++) {
    if (slice[i] === 0) {
      throw new SandboxFsError("Binary files are not editable in the playground", 415);
    }
  }
  return {
    path: userPath,
    contents: slice.toString("utf8"),
    size: stat.size,
    truncated,
  };
}

export async function writeFile(
  sandboxId: string,
  userPath: string,
  contents: string
): Promise<{ path: string; size: number }> {
  const abs = resolveSafe(sandboxId, userPath);
  if (Buffer.byteLength(contents, "utf8") > MAX_TEXT_BYTES) {
    throw new SandboxFsError("File too large", 413);
  }
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, contents, "utf8");
  const stat = await fs.stat(abs);
  return { path: userPath, size: stat.size };
}

export async function removeFile(sandboxId: string, userPath: string): Promise<{ path: string }> {
  const root = workspaceRoot(sandboxId);
  const abs = resolveSafe(sandboxId, userPath);
  if (abs === root) {
    throw new SandboxFsError("Refusing to delete the workspace root", 400);
  }
  try {
    await fs.rm(abs, { recursive: true, force: false });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new SandboxFsError("File not found", 404);
    throw err;
  }
  return { path: userPath };
}

export async function removeAll(sandboxId: string): Promise<void> {
  const root = sandboxRoot(sandboxId);
  await fs.rm(root, { recursive: true, force: true });
}
