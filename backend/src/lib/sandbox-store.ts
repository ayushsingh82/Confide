/**
 * Sandbox session tracker.
 *
 * Today: in-memory only — placeholder for the real spawn API (plan.md §11).
 * Tomorrow: every entry maps to a real Phala / Azure CC VM and we'll publish
 * a websocket URL keyed by id.
 */

import crypto from "node:crypto";
import type { SandboxSession } from "@/types/index.js";

const DEFAULT_TTL_MS = 30 * 60 * 1000;

const sessions = new Map<string, SandboxSession>();

function genId(): string {
  return `sbx_${crypto.randomBytes(8).toString("hex")}`;
}

function isExpired(session: SandboxSession): boolean {
  return Date.now() > session.expiresAt;
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
  // Simulate the boot sequence; the real path replaces these timeouts with VM events.
  setTimeout(() => advance(session.id, "spawning"), 400);
  setTimeout(() => advance(session.id, "cloning"), 1200);
  setTimeout(() => {
    const s = sessions.get(session.id);
    if (!s) return;
    sessions.set(s.id, {
      ...s,
      status: "ready",
      attestation: {
        verified: false, // flip to true once we wire dcap-qvl in the backend.
      },
    });
  }, 2200);
  return session;
}

function advance(id: string, status: SandboxSession["status"]): void {
  const s = sessions.get(id);
  if (!s) return;
  sessions.set(id, { ...s, status });
}

export function getSandbox(id: string): SandboxSession | null {
  const s = sessions.get(id);
  if (!s) return null;
  if (isExpired(s) && s.status !== "destroyed") {
    sessions.set(id, { ...s, status: "destroyed" });
    return sessions.get(id) ?? null;
  }
  return s;
}

export function destroySandbox(id: string): boolean {
  const s = sessions.get(id);
  if (!s) return false;
  sessions.set(id, { ...s, status: "destroyed" });
  return true;
}

export function listSandboxes(): SandboxSession[] {
  return Array.from(sessions.values());
}

/** Periodically destroy expired sessions. Called from server.ts on a setInterval. */
export function sweepExpired(): number {
  let count = 0;
  for (const [id, s] of sessions) {
    if (isExpired(s) && s.status !== "destroyed") {
      sessions.set(id, { ...s, status: "destroyed" });
      count++;
    }
  }
  return count;
}
