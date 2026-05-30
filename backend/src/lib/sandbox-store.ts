/**
 * Sandbox session tracker — now with real git clone.
 *
 * Each sandbox owns a directory at `${DATA_DIR}/sandboxes/<id>/workspace`.
 * Spawning kicks off a `git clone --depth=1` into that directory; the session
 * transitions through `queued → cloning → ready` (or `error`).
 *
 * When we wire a NEAR-hosted CVM, the only thing that changes is the body of
 * `boot()` — same SandboxSession surface, same status transitions, same routes
 * up the call stack.
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { config } from "@/config.js";
import {
  removeAll,
  sandboxRoot,
  workspaceRoot,
} from "@/lib/sandbox-fs.js";
import type { SandboxSession } from "@/types/index.js";

const DEFAULT_TTL_MS = 30 * 60 * 1000;

const sessions = new Map<string, SandboxSession>();

function genId(): string {
  return `sbx_${crypto.randomBytes(8).toString("hex")}`;
}

function isExpired(session: SandboxSession): boolean {
  return Date.now() > session.expiresAt;
}

function update(id: string, patch: Partial<SandboxSession>): void {
  const s = sessions.get(id);
  if (!s) return;
  sessions.set(id, { ...s, ...patch });
}

async function gitClone(repoUrl: string, target: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      "git",
      ["clone", "--depth=1", "--single-branch", repoUrl, target],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      }
    );
    let stderr = "";
    child.stderr.on("data", (b: Buffer) => {
      stderr += b.toString("utf8").slice(0, 4096 - stderr.length);
    });
    const timeoutId = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("git clone timed out after 120s"));
    }, 120_000);
    timeoutId.unref();
    child.on("close", (code) => {
      clearTimeout(timeoutId);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `git clone exited with code ${code}`));
    });
    child.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

async function boot(id: string, repoUrl: string): Promise<void> {
  try {
    update(id, { status: "spawning" });
    // Clean any prior leftover from a same-id collision (shouldn't happen, but cheap).
    await removeAll(id);

    update(id, { status: "cloning" });
    await gitClone(repoUrl, workspaceRoot(id));

    update(id, {
      status: "ready",
      attestation: {
        // Marker so the frontend can tell "real workspace exists" from the
        // earlier mock state. Real TDX quote verification lands once we host
        // this on NEAR CVM infra (see plan.md §12).
        verified: false,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    update(id, { status: "error", error: message });
  }
}

export function createSandbox(repoUrl: string, ttlMs = DEFAULT_TTL_MS): SandboxSession {
  const now = Date.now();
  const session: SandboxSession = {
    id: genId(),
    repoUrl,
    status: "queued",
    createdAt: now,
    expiresAt: now + ttlMs,
  };
  sessions.set(session.id, session);
  // Kick the boot off without awaiting — the route returns immediately and
  // the client polls /v1/sandbox/:id for the status transition.
  void boot(session.id, repoUrl);
  return session;
}

export function getSandbox(id: string): SandboxSession | null {
  const s = sessions.get(id);
  if (!s) return null;
  if (isExpired(s) && s.status !== "destroyed") {
    void cleanup(id);
    return sessions.get(id) ?? null;
  }
  return s;
}

async function cleanup(id: string): Promise<void> {
  update(id, { status: "destroyed" });
  await removeAll(id).catch(() => undefined);
}

export function destroySandbox(id: string): boolean {
  const s = sessions.get(id);
  if (!s) return false;
  void cleanup(id);
  return true;
}

export function listSandboxes(): SandboxSession[] {
  return Array.from(sessions.values());
}

export function sweepExpired(): number {
  let count = 0;
  for (const [id, s] of sessions) {
    if (isExpired(s) && s.status !== "destroyed") {
      void cleanup(id);
      count++;
    }
  }
  return count;
}

export function getSandboxRootPaths(id: string): {
  root: string;
  workspace: string;
} {
  return { root: sandboxRoot(id), workspace: workspaceRoot(id) };
}

/**
 * Path-jailed file IO + exec are exposed through routes that re-derive paths
 * with sandbox-fs to keep the surface small here.
 */

// Make the data dir at module load so the first POST doesn't race a mkdir.
void fs.mkdir(path.join(config.dataDir, "sandboxes"), { recursive: true }).catch(() => undefined);
