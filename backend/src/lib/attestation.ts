/**
 * Attestation helpers.
 *
 * For the MVP this is a thin shape: we fetch NEAR's attestation report, sanity-
 * check the surface fields, and surface a `verified: false` flag if anything
 * looks wrong. The full `dcap-qvl` TDX quote verification + NVIDIA NRAS round
 * trip is documented in md/06-tls-attestation.md and will land here once we
 * pull dcap-qvl into the backend.
 */

import crypto from "node:crypto";
import { attestationReport, NearError } from "@/lib/near.js";

export interface AttestationView {
  signingAddress?: string;
  modelName?: string;
  tlsCertFingerprint?: string;
  intelQuoteLength?: number;
  hasNvidiaPayload: boolean;
  nonce: string;
  /** Best-effort: did the response include the fields we expect? */
  surfaceCheckPassed: boolean;
  /** True once full TDX quote verification is wired (pending dcap-qvl). */
  verified: boolean;
  raw: unknown;
}

export function newNonce(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function fetchAttestation(opts?: {
  nonce?: string;
  includeTlsFingerprint?: boolean;
}): Promise<AttestationView> {
  const nonce = opts?.nonce ?? newNonce();
  const raw = (await attestationReport({
    signingAlgo: "ecdsa",
    nonce,
    includeTlsFingerprint: opts?.includeTlsFingerprint ?? true,
  })) as Record<string, unknown>;

  const intelQuote = typeof raw.intel_quote === "string" ? raw.intel_quote : undefined;
  const tlsFp =
    typeof raw.tls_cert_fingerprint === "string"
      ? raw.tls_cert_fingerprint
      : undefined;
  const signing =
    typeof raw.signing_address === "string" ? raw.signing_address : undefined;
  const modelName =
    typeof raw.model_name === "string" ? raw.model_name : undefined;
  const hasNvidia = Boolean(raw.nvidia_payload);

  // Surface check: do we at least have the things we'd need to do real verification?
  const surfaceCheckPassed =
    Boolean(intelQuote) && Boolean(signing) && intelQuote!.length > 200;

  const view: AttestationView = {
    nonce,
    hasNvidiaPayload: hasNvidia,
    surfaceCheckPassed,
    verified: false,
    raw,
  };
  if (signing) view.signingAddress = signing;
  if (modelName) view.modelName = modelName;
  if (tlsFp) view.tlsCertFingerprint = tlsFp;
  if (intelQuote) view.intelQuoteLength = intelQuote.length;
  return view;
}

export { NearError };
