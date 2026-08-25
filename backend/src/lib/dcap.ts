/**
 * TDX attestation verification helpers.
 *
 * Implements the hash-comparison checks from md/06-tls-attestation.md steps
 * 4/5/8 directly against Node's built-in crypto, rather than depending on the
 * `dcap-qvl` npm package (registry-flagged deprecated, no longer supported).
 * These are the checks a caller can run once it already has parsed
 * attestation fields (report_data, mr_config_id, tls_cert_fingerprint, ...) —
 * e.g. from NEAR's `/v1/attestation/report` or a future CVM's `attest.report`
 * frame.
 *
 * What this file does NOT do: parse a raw TDX quote binary, verify its ECDSA
 * signature, or walk the PCK certificate chain up to Intel's root of trust.
 * That's genuinely hard, security-critical binary parsing — see
 * `parseAndVerifyQuote` below.
 */

import crypto from "node:crypto";

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedError";
  }
}

function hexToBytes(hex: string): Buffer {
  return Buffer.from(hex.replace(/^0x/i, ""), "hex");
}

/**
 * report_data is a 64-byte field split into two 32-byte halves:
 *   report_data[0:32]  == SHA256(signing_address || tls_cert_fingerprint)
 *   report_data[32:64] == nonce
 * All string args are hex, optionally 0x-prefixed. See md/06 §4.
 */
export function verifyReportDataBinding(
  reportData: string,
  signingAddress: string,
  tlsCertFingerprint: string,
  nonce: string
): boolean {
  const bytes = hexToBytes(reportData);
  if (bytes.length !== 64) return false;

  const keyTlsHalf = bytes.subarray(0, 32);
  const nonceHalf = bytes.subarray(32, 64);

  const expectedKeyTls = crypto
    .createHash("sha256")
    .update(hexToBytes(signingAddress))
    .update(hexToBytes(tlsCertFingerprint))
    .digest();

  const bindsKeyAndTls = keyTlsHalf.equals(expectedKeyTls);
  const embedsNonce = nonceHalf.equals(hexToBytes(nonce));
  return bindsKeyAndTls && embedsNonce;
}

/** Live TLS cert's SPKI hash must equal the one bound into the quote. md/06 §5. */
export function verifySpkiMatch(liveCertSpkiHash: string, attestedSpkiHash: string): boolean {
  return liveCertSpkiHash.toLowerCase() === attestedSpkiHash.toLowerCase();
}

/**
 * mr_config_id == "01" + SHA256(app_compose_str) — binds the published
 * Docker Compose file to this TEE. `mr_config_id` may come back all-zeros
 * during a TEE configuration transition; callers should treat that as
 * "skip this check", not "fail" (md/06 §8).
 */
export function verifyComposeHash(mrConfigId: string, composeFileSha256: string): boolean {
  const expected = `01${composeFileSha256}`.toLowerCase();
  return mrConfigId.toLowerCase().startsWith(expected);
}

/**
 * Raw TDX quote parsing + ECDSA-P256 signature verification + PCK
 * certificate-chain validation against Intel's root of trust (md/06 §3 —
 * what `dcap_qvl.get_collateral_and_verify` does). Hand-rolling binary quote
 * parsing and cert-chain crypto with no real quote fixture to validate
 * against would be unsound, so this is intentionally unimplemented. Wire it
 * up once a real CVM produces an actual quote, using a maintained verifier —
 * not by approximating success here.
 */
export async function parseAndVerifyQuote(_rawQuoteHex: string): Promise<never> {
  throw new NotImplementedError(
    "parseAndVerifyQuote is not implemented: raw TDX quote parsing and PCK " +
      "certificate-chain verification require a real quote fixture and a " +
      "maintained DCAP verifier, neither of which exist yet in this project. " +
      "See md/06-tls-attestation.md step 3."
  );
}
