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
    id: "glm-4.6",
    label: "GLM-4.6 FP8",
    contextLength: 200_000,
    description: "Zhipu, 358B params, FP8 quantized",
  },
  {
    id: "gpt-oss-120b",
    label: "GPT-OSS 120B",
    contextLength: 131_000,
    description: "OpenAI open-weight, 117B MoE",
  },
  {
    id: "deepseek-v3.1",
    label: "DeepSeek V3.1",
    contextLength: 128_000,
    description: "Hybrid thinking/non-thinking",
  },
  {
    id: "qwen3-30b-a3b-instruct-2507",
    label: "Qwen3 30B A3B",
    contextLength: 262_000,
    description: "MoE, 30.5B total / 3.3B active",
  },
];
