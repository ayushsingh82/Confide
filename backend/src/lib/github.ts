/**
 * GitHub OAuth + REST helpers.
 *
 * OAuth flow:
 *   1. Browser hits /v1/auth/github/start  -> we redirect to authorizeUrl()
 *   2. GitHub redirects to /v1/auth/github/callback?code=&state=
 *   3. We exchange the code for an access token, fetch the user, mint a session
 *   4. Redirect back to the frontend with the session cookie set
 */

import { request } from "undici";
import crypto from "node:crypto";
import { config, hasGithubOAuth } from "@/config.js";

const SCOPES = ["read:user", "public_repo"];

export class GithubError extends Error {
  constructor(message: string, public status: number, public detail?: string) {
    super(message);
    this.name = "GithubError";
  }
}

export function callbackUrl(): string {
  return `${config.publicBackendUrl}/v1/auth/github/callback`;
}

function hmac(state: string): string {
  return crypto
    .createHmac("sha256", config.sessionSecret)
    .update(state)
    .digest("hex");
}

/** Build the GitHub authorize URL + a signed state string we'll verify on callback. */
export function authorizeUrl(returnTo: string): { url: string; state: string } {
  if (!hasGithubOAuth) {
    throw new GithubError("GitHub OAuth not configured", 503);
  }
  const nonce = crypto.randomBytes(16).toString("hex");
  // Embed where to send the user after login + an HMAC so we can verify it
  // hasn't been tampered with. Format: `<nonce>:<returnTo>:<sig>`.
  const payload = `${nonce}:${returnTo}`;
  const sig = hmac(payload);
  const state = `${payload}:${sig}`;
  const params = new URLSearchParams({
    client_id: config.githubClientId,
    redirect_uri: callbackUrl(),
    scope: SCOPES.join(" "),
    state,
    allow_signup: "true",
  });
  return { url: `https://github.com/login/oauth/authorize?${params}`, state };
}

/** Verify the state string came from us and return the embedded returnTo URL. */
export function verifyState(state: string | undefined): string | null {
  if (!state) return null;
  const parts = state.split(":");
  if (parts.length < 3) return null;
  const sig = parts.pop()!;
  const payload = parts.join(":");
  const expected = hmac(payload);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  const returnTo = parts.slice(1).join(":");
  return returnTo || config.publicFrontendUrl;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  if (!hasGithubOAuth) {
    throw new GithubError("GitHub OAuth not configured", 503);
  }
  const response = await request("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
      redirect_uri: callbackUrl(),
    }),
  });
  const body = (await response.body.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!body.access_token) {
    throw new GithubError(
      body.error_description || body.error || "Failed to exchange code",
      response.statusCode
    );
  }
  return body.access_token;
}

interface GithubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

export async function fetchUser(accessToken: string): Promise<GithubUser> {
  const response = await request("https://api.github.com/user", {
    method: "GET",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${accessToken}`,
      "user-agent": "confide-backend",
    },
  });
  if (response.statusCode >= 400) {
    const text = await response.body.text();
    throw new GithubError(
      `GitHub user fetch failed (${response.statusCode})`,
      response.statusCode,
      text.slice(0, 1000)
    );
  }
  return (await response.body.json()) as GithubUser;
}

export interface GithubRepoSummary {
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

export async function listUserRepos(
  accessToken: string,
  opts: { perPage?: number; sort?: "updated" | "pushed" | "created" | "full_name" } = {}
): Promise<GithubRepoSummary[]> {
  const params = new URLSearchParams({
    per_page: String(opts.perPage ?? 30),
    sort: opts.sort ?? "updated",
    affiliation: "owner,collaborator,organization_member",
  });
  const response = await request(`https://api.github.com/user/repos?${params}`, {
    method: "GET",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${accessToken}`,
      "user-agent": "confide-backend",
    },
  });
  if (response.statusCode >= 400) {
    const text = await response.body.text();
    throw new GithubError(
      `GitHub repos fetch failed (${response.statusCode})`,
      response.statusCode,
      text.slice(0, 1000)
    );
  }
  const raw = (await response.body.json()) as Array<{
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    clone_url: string;
    description: string | null;
    private: boolean;
    default_branch: string;
    language: string | null;
    updated_at: string;
    stargazers_count: number;
  }>;
  return raw.map((r) => ({
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    htmlUrl: r.html_url,
    cloneUrl: r.clone_url,
    description: r.description,
    private: r.private,
    defaultBranch: r.default_branch,
    language: r.language,
    updatedAt: r.updated_at,
    stargazersCount: r.stargazers_count,
  }));
}
