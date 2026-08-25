import "dotenv/config";
import path from "node:path";

function readString(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Env var ${name} must be a number, got: ${raw}`);
  }
  return parsed;
}

export const config = {
  port: readNumber("PORT", 4000),
  host: readString("HOST", "0.0.0.0"),
  /** Set at boot, may be `undefined` so the server still starts in stub mode. */
  nearApiKey: process.env.NEAR_API_KEY ?? "",
  nearApiBase: readString("NEAR_API_BASE", "https://cloud-api.near.ai"),
  corsOrigin: readString("CORS_ORIGIN", "http://localhost:3000"),
  dataDir: path.resolve(readString("DATA_DIR", "./data")),

  // GitHub OAuth — empty strings disable the auth routes gracefully.
  githubClientId: process.env.GITHUB_CLIENT_ID ?? "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
  publicBackendUrl: readString("PUBLIC_BACKEND_URL", "http://localhost:4000"),
  publicFrontendUrl: readString("PUBLIC_FRONTEND_URL", "http://localhost:3000"),
  sessionSecret: readString(
    "SESSION_SECRET",
    "dev-only-session-secret-change-me"
  ),

  // Which CVMProvider backs /v1/sandbox spawns. "mock" (default) runs the
  // sandbox locally on this backend host and serves the agent WS protocol
  // itself — see lib/cvm-provider.ts. "phala"/"near" are unconfigured stubs
  // until a real hosting partnership lands (see md/plan.md §13).
  cvmProvider: readString("CVM_PROVIDER", "mock") as "mock" | "phala" | "near",
  sandboxJwtSecret: readString(
    "SANDBOX_JWT_SECRET",
    "dev-only-sandbox-jwt-secret-change-me"
  ),
} as const;

export const hasNearKey = config.nearApiKey.length > 0;
export const hasGithubOAuth =
  config.githubClientId.length > 0 && config.githubClientSecret.length > 0;
