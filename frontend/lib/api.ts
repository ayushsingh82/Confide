/**
 * Thin browser-side client for the Confide backend.
 *
 * Hostname is configurable via NEXT_PUBLIC_BACKEND_URL; defaults to
 * http://localhost:4000 for dev. Every request sends `credentials: include`
 * so the session cookie travels with cross-origin calls.
 */

const BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

export const backendUrl = (path: string): string =>
  `${BASE}${path.startsWith("/") ? path : `/${path}`}`;

interface ApiError {
  error: string;
  detail?: string;
  status: number;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(backendUrl(path), {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let payload: { error?: string; detail?: string } = {};
    try {
      payload = (await res.json()) as { error?: string; detail?: string };
    } catch {
      // non-JSON error body — leave payload empty
    }
    const err: ApiError = {
      error: payload.error ?? `HTTP ${res.status}`,
      status: res.status,
    };
    if (payload.detail) err.detail = payload.detail;
    throw err;
  }
  return (await res.json()) as T;
}

// Typed shapes the frontend cares about (matches backend/src/types).

export interface LiveModel {
  id: string;
  label: string;
  contextLength?: number;
  description?: string;
}

interface RawNearModel {
  id: string;
  name?: string;
  is_ready?: boolean;
  output_modalities?: string[];
  context_length?: number;
  description?: string;
}

interface ModelsResponse {
  cached: boolean;
  fallback?: boolean;
  // Real NEAR catalog nests the array under `.data`; our no-key fallback
  // (backend/src/routes/models.ts) returns it flat.
  data: { data?: RawNearModel[] } | RawNearModel[];
}

// Ids that pass every other filter but aren't chat-completion models
// (audio transcription, embeddings, reranking, image gen, moderation).
const NON_CHAT_ID = /whisper|embedding|rerank|privacy-filter|flux/i;

function normalizeModels(payload: ModelsResponse): LiveModel[] {
  const raw = Array.isArray(payload.data) ? payload.data : payload.data.data ?? [];
  return raw
    .filter((m) => m.is_ready !== false)
    .filter((m) => (m.output_modalities ?? ["text"]).includes("text"))
    .filter((m) => !NON_CHAT_ID.test(m.id))
    .map((m) => ({
      id: m.id,
      label: m.name ?? m.id,
      contextLength: m.context_length,
      description: m.description,
    }));
}

export interface GithubUser {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
}

export interface MeResponse {
  authenticated: boolean;
  provider?: "github";
  user?: GithubUser;
  expiresAt?: number;
}

export interface GithubRepo {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  cloneUrl: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  language: string | null;
  updatedAt: string;
  stargazersCount: number;
}

export interface SandboxSession {
  id: string;
  repoUrl: string;
  status: "queued" | "spawning" | "cloning" | "ready" | "error" | "destroyed";
  createdAt: number;
  expiresAt: number;
  attestation?: { verified: boolean; mocked: boolean };
  /** WebSocket URL for the bridge protocol (fs/pty/chat/attest frames). */
  wssUrl?: string;
  /** Short-lived session token required to open the agent WS connection. */
  jwt?: string;
  error?: string;
}

export const api = {
  /** GET /v1/models — live NEAR catalog, filtered to ready chat-completion models. */
  models(): Promise<LiveModel[]> {
    return apiFetch<ModelsResponse>("/v1/models").then(normalizeModels);
  },
  me(): Promise<MeResponse> {
    return apiFetch<MeResponse>("/v1/auth/me").catch((e: ApiError) => {
      if (e.status === 401) return { authenticated: false };
      throw e;
    });
  },
  startGithubLogin(returnTo: string): string {
    const params = new URLSearchParams({ returnTo });
    return backendUrl(`/v1/auth/github/start?${params}`);
  },
  async logout(): Promise<void> {
    await fetch(backendUrl("/v1/auth/logout"), {
      method: "POST",
      credentials: "include",
    });
  },
  repos(opts: { perPage?: number; sort?: "updated" | "pushed" | "created" | "full_name" } = {}): Promise<{
    count: number;
    repos: GithubRepo[];
  }> {
    const params = new URLSearchParams();
    if (opts.perPage) params.set("per_page", String(opts.perPage));
    if (opts.sort) params.set("sort", opts.sort);
    const qs = params.toString() ? `?${params}` : "";
    return apiFetch<{ count: number; repos: GithubRepo[] }>(`/v1/github/repos${qs}`);
  },
  spawnSandbox(repoUrl: string, ttlMs?: number): Promise<SandboxSession> {
    const body: { repoUrl: string; ttlMs?: number } = { repoUrl };
    if (ttlMs !== undefined) body.ttlMs = ttlMs;
    return apiFetch<SandboxSession>("/v1/sandbox", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  getSandbox(id: string): Promise<SandboxSession> {
    return apiFetch<SandboxSession>(`/v1/sandbox/${encodeURIComponent(id)}`);
  },
  destroySandbox(id: string): Promise<void> {
    return fetch(backendUrl(`/v1/sandbox/${encodeURIComponent(id)}`), {
      method: "DELETE",
      credentials: "include",
    }).then(() => undefined);
  },
  sandboxTree(id: string): Promise<{ tree: SandboxTreeNode }> {
    return apiFetch(`/v1/sandbox/${encodeURIComponent(id)}/tree`);
  },
  readSandboxFile(
    id: string,
    path: string
  ): Promise<{ path: string; contents: string; size: number; truncated: boolean }> {
    const params = new URLSearchParams({ path });
    return apiFetch(`/v1/sandbox/${encodeURIComponent(id)}/file?${params}`);
  },
  writeSandboxFile(
    id: string,
    path: string,
    contents: string
  ): Promise<{ path: string; size: number }> {
    return apiFetch(`/v1/sandbox/${encodeURIComponent(id)}/file`, {
      method: "PUT",
      body: JSON.stringify({ path, contents }),
    });
  },
  exec(
    id: string,
    cmd: string,
    args: string[] = [],
    opts: { cwd?: string; timeoutMs?: number } = {}
  ): Promise<SandboxExecResult> {
    const body: Record<string, unknown> = { cmd, args };
    if (opts.cwd) body.cwd = opts.cwd;
    if (opts.timeoutMs) body.timeoutMs = opts.timeoutMs;
    return apiFetch(`/v1/sandbox/${encodeURIComponent(id)}/exec`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};

export interface SandboxTreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: SandboxTreeNode[];
}

export interface SandboxExecResult {
  cmd: string;
  args: string[];
  exitCode: number | null;
  signal: string | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  timedOut: boolean;
}
