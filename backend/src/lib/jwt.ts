/**
 * Sandbox agent session tokens.
 *
 * Not a full JWT library — just an HMAC-SHA256 signed, expiring token bound
 * to a sandbox id + its attested SPKI hash (or the literal "mock" when
 * MockProvider has no real TLS pinning to bind to). Minted once a sandbox is
 * ready, verified before the WS agent route upgrades the connection.
 */

import crypto from "node:crypto";
import { config } from "@/config.js";

const TTL_MS = 5 * 60 * 1000;

interface Payload {
  sandboxId: string;
  spkiHash: string;
  exp: number;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", config.sandboxJwtSecret).update(data).digest("base64url");
}

export function mintSandboxToken(sandboxId: string, spkiHash = "mock"): string {
  const payload: Payload = { sandboxId, spkiHash, exp: Date.now() + TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySandboxToken(
  token: string,
  sandboxId: string
): { ok: true } | { ok: false; reason: string } {
  const [body, sig] = token.split(".");
  if (!body || !sig) return { ok: false, reason: "Malformed token" };

  const expected = sign(body);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, reason: "Bad signature" };
  }

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
  } catch {
    return { ok: false, reason: "Bad payload" };
  }
  if (payload.sandboxId !== sandboxId) return { ok: false, reason: "Sandbox id mismatch" };
  if (Date.now() > payload.exp) return { ok: false, reason: "Token expired" };
  return { ok: true };
}
