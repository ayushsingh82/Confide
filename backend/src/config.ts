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
} as const;

export const hasNearKey = config.nearApiKey.length > 0;
