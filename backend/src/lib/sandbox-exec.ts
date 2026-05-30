/**
 * Run a command inside a sandbox workspace.
 *
 * Synchronous (buffered) for v0 — caps output and wall-clock so a runaway
 * `npm install` or `python -c 'while True: pass'` can't take the backend
 * down. Streaming via SSE/WS lands once the WS bridge in plan §12.D is built.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { workspaceRoot } from "@/lib/sandbox-fs.js";

const MAX_OUTPUT_BYTES = 512 * 1024; // 512 KB per stream
const DEFAULT_TIMEOUT_MS = 60_000;

export interface ExecResult {
  cmd: string;
  args: string[];
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  timedOut: boolean;
}

const ALLOWED: Record<string, RegExp[]> = {
  // Empty `args` lists mean "any args allowed".
  npm: [],
  pnpm: [],
  yarn: [],
  node: [],
  npx: [],
  python: [],
  python3: [],
  pip: [],
  pip3: [],
  go: [],
  cargo: [],
  rustc: [],
  bash: [/^-c$/, /.*/],
  sh: [/^-c$/, /.*/],
  // Common builtins
  ls: [],
  cat: [],
  pwd: [],
  echo: [],
  ripgrep: [],
  rg: [],
  grep: [],
  git: [],
  make: [],
  curl: [], // egress is open in local dev — we'll lock down inside the CVM later
};

export class ExecError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ExecError";
  }
}

function isCommandAllowed(cmd: string): boolean {
  // Reject anything that looks like a path; only bare binary names allowed.
  if (cmd.includes("/") || cmd.includes("\\")) return false;
  return Object.prototype.hasOwnProperty.call(ALLOWED, cmd);
}

export async function runCommand(
  sandboxId: string,
  cmd: string,
  args: string[],
  opts: { timeoutMs?: number; cwd?: string } = {}
): Promise<ExecResult> {
  if (!isCommandAllowed(cmd)) {
    throw new ExecError(`Command "${cmd}" is not on the allowlist`, 400);
  }
  const timeout = Math.min(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, 5 * 60_000);
  const root = workspaceRoot(sandboxId);
  const cwd = opts.cwd
    ? path.resolve(root, opts.cwd.replace(/^\/+/, ""))
    : root;
  // Defense in depth — never escape the workspace.
  if (!(cwd + path.sep).startsWith(root + path.sep) && cwd !== root) {
    throw new ExecError("cwd escapes workspace", 403);
  }

  return new Promise<ExecResult>((resolve) => {
    const started = Date.now();
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, FORCE_COLOR: "0", CI: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;

    const append = (
      buf: Buffer,
      slot: "out" | "err"
    ): void => {
      const remaining =
        MAX_OUTPUT_BYTES - (slot === "out" ? stdout.length : stderr.length);
      if (remaining <= 0) {
        if (slot === "out") stdoutTruncated = true;
        else stderrTruncated = true;
        return;
      }
      const chunk = buf.subarray(0, remaining).toString("utf8");
      if (slot === "out") stdout += chunk;
      else stderr += chunk;
      if (buf.length > remaining) {
        if (slot === "out") stdoutTruncated = true;
        else stderrTruncated = true;
      }
    };

    child.stdout.on("data", (b: Buffer) => append(b, "out"));
    child.stderr.on("data", (b: Buffer) => append(b, "err"));

    const killer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
    }, timeout);
    killer.unref();

    child.on("close", (code, signal) => {
      clearTimeout(killer);
      resolve({
        cmd,
        args,
        exitCode: code,
        signal: signal as NodeJS.Signals | null,
        durationMs: Date.now() - started,
        stdout,
        stderr,
        stdoutTruncated,
        stderrTruncated,
        timedOut,
      });
    });

    child.on("error", (err) => {
      clearTimeout(killer);
      resolve({
        cmd,
        args,
        exitCode: null,
        signal: null,
        durationMs: Date.now() - started,
        stdout,
        stderr: stderr + `\n${err.message}`,
        stdoutTruncated,
        stderrTruncated,
        timedOut: false,
      });
    });
  });
}

export { ALLOWED as ALLOWED_COMMANDS };
