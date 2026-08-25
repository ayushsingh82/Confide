/**
 * Shared types between routes and libs.
 * Mirrors the shapes used by the frontend in /frontend/lib/types.ts and /frontend/lib/usage.ts,
 * so we can lift either side to be authoritative later without a rewrite.
 */

export type Role = "user" | "assistant" | "system";

export interface Message {
  role: Role;
  content: string;
}

export interface ChatRequestBody {
  model: string;
  messages: Message[];
  /** Optional sampling params, forwarded verbatim to NEAR. */
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string[];
  /** Reasoning toggles for DeepSeek/GLM/Qwen — passed through unchanged. */
  chat_template_kwargs?: Record<string, unknown>;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface Attestation {
  /** TEE family — "intel-tdx", "h100-cc", etc. */
  tee?: string;
  /** Hex digest of the attestation evidence if NEAR returns one. */
  hash?: string;
  /** Whether NEAR returned a real attestation field. */
  attested: boolean;
}

export interface ReceiptSignature {
  /** Hex ECDSA / Ed25519 signature over `text`. */
  sig: string;
  /** Public-key-derived address used to verify the signature. */
  signingAddress: string;
  /** `ecdsa` or `ed25519` */
  signingAlgo: string;
  /** Signed payload — `{model}:{requestHash}:{responseHash}` */
  text: string;
  /** SHA-256 of the request, parsed out of `text`. */
  requestHash: string;
  /** SHA-256 of the response, parsed out of `text`. */
  responseHash: string;
}

export interface Receipt {
  id: string;
  model: string;
  /** Wall-clock latency for the round trip (ms). */
  latencyMs: number;
  finishReason?: string;
  usage?: Usage;
  requestId?: string;
  attestation: Attestation;
  /** True only when no NEAR_API_KEY is configured (stub mode). */
  mocked: boolean;
  /** Signed receipt from GET /v1/signature/{chat_id}, when available. */
  signature?: ReceiptSignature;
  /** Full upstream JSON, kept for `view raw receipt` in the UI. */
  raw?: unknown;
}

export interface ChatResponseBody {
  reply: string;
  receipt: Receipt;
  /** Server-side usage event id (matches the one logged to data/usage.jsonl). */
  usageEventId?: string;
}

export interface UsageEvent {
  id: string;
  /** Unix ms timestamp */
  ts: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  inputCostUSD: number;
  outputCostUSD: number;
  totalCostUSD: number;
  latencyMs: number;
  attested: boolean;
  requestId?: string;
}

export type UsageRange = "24h" | "7d" | "30d" | "90d";

export interface UsageTotals {
  agentRuns: number;
  sessions: number;
  totalTokens: number;
  totalCostUSD: number;
}

export interface SandboxSession {
  id: string;
  repoUrl: string;
  status: "queued" | "spawning" | "cloning" | "ready" | "error" | "destroyed";
  /** Unix ms timestamps */
  createdAt: number;
  expiresAt: number;
  attestation?: {
    tdxQuote?: string;
    spkiHash?: string;
    verified: boolean;
  };
  error?: string;
}
