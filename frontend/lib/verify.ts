/**
 * In-browser verification of a NEAR signed chat receipt.
 *
 * NEAR signs `text` = `${model}:${requestSha256}:${responseSha256}` with ECDSA
 * over secp256k1. The exact pre-image hash they apply isn't published, so we
 * try the three common schemes and accept the first that recovers an address
 * matching `signing_address`:
 *
 *   - keccak256(text)               (Ethereum raw secp256k1)
 *   - sha256(text)                  (matches the SHA-256-everywhere convention)
 *   - personal_sign / hashMessage   ("\x19Ethereum Signed Message:\n" prefix)
 *
 * Whichever wins, we report back which scheme matched so we can lock it in
 * for the next iteration. The user gets cryptographic proof either way.
 */

import {
  hashMessage,
  keccak256,
  recoverAddress,
  sha256,
  toBytes,
  type Hex,
} from "viem";
import type { Receipt } from "@/lib/types";

type Scheme = "keccak256(text)" | "sha256(text)" | "personal_sign(text)";

interface Attempt {
  scheme: Scheme;
  hash: Hex;
}

export type VerifyResult =
  | { ok: true; recoveredAddress: string; scheme: Scheme }
  | { ok: false; reason: string; attempts: Array<{ scheme: Scheme; recovered: string }> };

function normalizeHex(value: string): Hex {
  const trimmed = value.trim();
  return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as Hex;
}

export async function verifyReceipt(
  receipt: Receipt
): Promise<VerifyResult> {
  const sig = receipt.signature;
  if (!sig) {
    return {
      ok: false,
      reason: "Receipt has no signature payload",
      attempts: [],
    };
  }
  if (sig.signingAlgo !== "ecdsa") {
    return {
      ok: false,
      reason: `Unsupported signing algorithm: ${sig.signingAlgo}. Browser verifier handles ecdsa today.`,
      attempts: [],
    };
  }
  const signature = normalizeHex(sig.sig);
  // 0x + 64 bytes (r+s) + 1 byte v = 132 hex chars including 0x prefix.
  if (signature.length !== 132) {
    return {
      ok: false,
      reason: `Signature length unexpected: ${signature.length} chars (expected 132)`,
      attempts: [],
    };
  }

  const textBytes = toBytes(sig.text);
  const attempts: Attempt[] = [
    { scheme: "keccak256(text)", hash: keccak256(textBytes) },
    { scheme: "sha256(text)", hash: sha256(textBytes) },
    { scheme: "personal_sign(text)", hash: hashMessage(sig.text) },
  ];

  const expected = sig.signingAddress.toLowerCase();
  const tried: Array<{ scheme: Scheme; recovered: string }> = [];

  for (const a of attempts) {
    try {
      const recovered = await recoverAddress({ hash: a.hash, signature });
      tried.push({ scheme: a.scheme, recovered });
      if (recovered.toLowerCase() === expected) {
        return { ok: true, recoveredAddress: recovered, scheme: a.scheme };
      }
    } catch (err) {
      tried.push({
        scheme: a.scheme,
        recovered: err instanceof Error ? `error: ${err.message}` : "error",
      });
    }
  }

  return {
    ok: false,
    reason:
      "Recovered address does not match the signing address NEAR returned (tried keccak256, sha256, personal_sign). NEAR may use a custom pre-image; tell us which scheme to add.",
    attempts: tried,
  };
}
