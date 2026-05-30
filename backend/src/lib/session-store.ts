/**
 * In-memory session store. Keyed by an opaque session id that lives in an
 * httpOnly cookie. The cookie carries the id only; the access token and user
 * profile stay on the server.
 *
 * Migration path: swap this Map for Redis or Postgres without touching the
 * route layer — the surface (`createSession`, `getSession`, `revokeSession`)
 * is the same.
 */

import crypto from "node:crypto";

export interface GithubSession {
  id: string;
  /** GitHub OAuth access token — keep server-side. */
  accessToken: string;
  user: {
    id: number;
    login: string;
    name: string | null;
    avatarUrl: string;
    htmlUrl: string;
  };
  /** Unix ms timestamps */
  createdAt: number;
  expiresAt: number;
}

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const sessions = new Map<string, GithubSession>();

export function newSessionId(): string {
  // 32 bytes -> 64 hex chars. Plenty of entropy, fits in a cookie cleanly.
  return crypto.randomBytes(32).toString("hex");
}

export function createSession(
  partial: Omit<GithubSession, "id" | "createdAt" | "expiresAt">
): GithubSession {
  const now = Date.now();
  const session: GithubSession = {
    ...partial,
    id: newSessionId(),
    createdAt: now,
    expiresAt: now + TTL_MS,
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string | undefined): GithubSession | null {
  if (!id) return null;
  const s = sessions.get(id);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    sessions.delete(id);
    return null;
  }
  return s;
}

export function revokeSession(id: string | undefined): boolean {
  if (!id) return false;
  return sessions.delete(id);
}
