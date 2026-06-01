export type Role = "user" | "assistant" | "system";

export interface Message {
  role: Role;
  content: string;
}

export interface Receipt {
  /** Model that generated this response (echoed from NEAR). */
  model: string;
  /** Wall-clock latency measured client-side (ms). */
  latencyMs: number;
  /** finish_reason from the completion. */
  finishReason?: string;
  /** Token usage. */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  /** Request ID, from response header or body if NEAR returns one. */
  requestId?: string;
  /** TEE family if NEAR includes it (e.g. "intel-tdx", "h100-cc"). */
  tee?: string;
  /** Hex digest of attestation evidence if NEAR returns one. */
  attestationHash?: string;
  /** True only when NEAR returned a real attestation field. */
  attested: boolean;
  /** True when the API key is missing and this is a stub. */
  mocked: boolean;
  /** Raw NEAR response, kept for "view raw receipt". */
  raw?: unknown;
  /** Signed receipt from GET /v1/signature/{chat_id} */
  signature?: {
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
  };
}

export interface ChatRequestBody {
  model: string;
  messages: Message[];
}

export interface ChatResponseBody {
  reply: string;
  receipt: Receipt;
}

export interface ModelOption {
  id: string;
  label: string;
  contextLength: number;
  description: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "anthropic/claude-opus-4-7",
    label: "Claude Opus 4.7",
    contextLength: 1_000_000,
    description: "Long-running agents & complex coding · $5/$25 per M",
  },
  {
    id: "zai-org/GLM-5.1-FP8",
    label: "GLM 5.1",
    contextLength: 203_000,
    description: "Open foundation model · systems engineering · $0.85/$3.30 per M",
  },
  {
    id: "deepseek-ai/DeepSeek-V3.1",
    label: "DeepSeek V3.1",
    contextLength: 128_000,
    description: "Hybrid thinking/non-thinking mode",
  },
  {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    contextLength: 131_000,
    description: "OpenAI open-weight 117B MoE · $0.15/$0.55 per M",
  },
  {
    id: "Qwen/Qwen3-30B-A3B-Instruct-2507",
    label: "Qwen3 30B A3B",
    contextLength: 262_000,
    description: "MoE, 30.5B total / 3.3B active · $0.15/$0.55 per M",
  },
];
