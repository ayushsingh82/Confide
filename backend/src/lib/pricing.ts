/**
 * NEAR AI Cloud per-million-token pricing.
 *
 * Authoritative source of cost numbers for the backend. Mirrors the catalog
 * the frontend ships at frontend/lib/near-models.ts; when NEAR ships a public
 * pricing endpoint we'll switch to caching that instead.
 */

export interface ModelPricing {
  modelId: string;
  /** USD per 1M input tokens. 0 means "free / unmetered". */
  inputPerM: number;
  /** USD per 1M output tokens. */
  outputPerM: number;
}

export const PRICING: Record<string, ModelPricing> = Object.fromEntries(
  (
    [
      // Anthropic
      { modelId: "anthropic/claude-haiku-4-5", inputPerM: 1.0, outputPerM: 5.0 },
      { modelId: "anthropic/claude-opus-4-6", inputPerM: 5.0, outputPerM: 25.0 },
      { modelId: "anthropic/claude-opus-4-7", inputPerM: 5.0, outputPerM: 25.0 },
      { modelId: "anthropic/claude-sonnet-4-5", inputPerM: 3.0, outputPerM: 15.5 },
      { modelId: "anthropic/claude-sonnet-4-6", inputPerM: 3.0, outputPerM: 15.0 },
      // DeepSeek
      { modelId: "deepseek-ai/DeepSeek-V3.1", inputPerM: 1.0, outputPerM: 2.5 },
      // Black Forest Labs
      { modelId: "black-forest-labs/FLUX.2-klein-4B", inputPerM: 1.0, outputPerM: 1.0 },
      // Google
      { modelId: "google/gemini-2.5-flash", inputPerM: 0.3, outputPerM: 2.5 },
      { modelId: "google/gemini-2.5-flash-lite", inputPerM: 0.1, outputPerM: 0.4 },
      { modelId: "google/gemini-2.5-pro", inputPerM: 1.25, outputPerM: 10.0 },
      { modelId: "google/gemini-3.1-flash-lite", inputPerM: 0.25, outputPerM: 1.5 },
      { modelId: "google/gemini-3.5-flash", inputPerM: 1.5, outputPerM: 9.0 },
      { modelId: "google/gemini-3-pro", inputPerM: 1.25, outputPerM: 15.0 },
      { modelId: "google/gemma-4-31B-it", inputPerM: 0.13, outputPerM: 0.4 },
      // Moonshot
      { modelId: "moonshotai/kimi-k2.6", inputPerM: 0.8, outputPerM: 3.5 },
      // OpenAI
      { modelId: "openai/gpt-4.1", inputPerM: 2.0, outputPerM: 8.0 },
      { modelId: "openai/gpt-4.1-mini", inputPerM: 0.4, outputPerM: 1.6 },
      { modelId: "openai/gpt-4.1-nano", inputPerM: 0.1, outputPerM: 0.4 },
      { modelId: "openai/gpt-5", inputPerM: 1.25, outputPerM: 10.0 },
      { modelId: "openai/gpt-5-mini", inputPerM: 0.25, outputPerM: 2.0 },
      { modelId: "openai/gpt-5-nano", inputPerM: 0.05, outputPerM: 0.4 },
      { modelId: "openai/gpt-5.1", inputPerM: 1.25, outputPerM: 10.0 },
      { modelId: "openai/gpt-5.2", inputPerM: 1.8, outputPerM: 15.5 },
      { modelId: "openai/gpt-5.4", inputPerM: 2.5, outputPerM: 15.0 },
      { modelId: "openai/gpt-5.4-mini", inputPerM: 0.75, outputPerM: 4.5 },
      { modelId: "openai/gpt-5.4-nano", inputPerM: 0.2, outputPerM: 1.25 },
      { modelId: "openai/gpt-5.5", inputPerM: 5.0, outputPerM: 30.0 },
      { modelId: "openai/gpt-oss-120b", inputPerM: 0.15, outputPerM: 0.55 },
      { modelId: "openai/o3", inputPerM: 2.0, outputPerM: 8.0 },
      { modelId: "openai/o3-mini", inputPerM: 1.1, outputPerM: 4.4 },
      { modelId: "openai/o4-mini", inputPerM: 1.1, outputPerM: 4.4 },
      { modelId: "openai/privacy-filter", inputPerM: 0.01, outputPerM: 0 },
      { modelId: "openai/whisper-large-v3", inputPerM: 0.01, outputPerM: 0.01 },
      // Alibaba / Qwen
      { modelId: "Qwen/Qwen3-30B-A3B-Instruct-2507", inputPerM: 0.15, outputPerM: 0.55 },
      { modelId: "Qwen/Qwen3.5-122B-A10B", inputPerM: 0.4, outputPerM: 3.2 },
      { modelId: "Qwen/Qwen3.6-35B-A3B-FP8", inputPerM: 0.17, outputPerM: 1.1 },
      { modelId: "qwen/qwen3.7-max", inputPerM: 2.8, outputPerM: 7.5 },
      { modelId: "Qwen/Qwen3-Embedding-0.6B", inputPerM: 0.01, outputPerM: 0.01 },
      { modelId: "Qwen/Qwen3-Reranker-0.6B", inputPerM: 0.01, outputPerM: 0.01 },
      { modelId: "Qwen/Qwen3-VL-30B-A3B-Instruct", inputPerM: 0.15, outputPerM: 0.55 },
      // Z.ai / GLM
      { modelId: "zai-org/GLM-5.1-FP8", inputPerM: 0.85, outputPerM: 3.3 },
    ] satisfies ModelPricing[]
  ).map((p) => [p.modelId, p])
);

export function priceFor(modelId: string): ModelPricing {
  const found = PRICING[modelId];
  if (found) return found;
  // Unknown model — return zeros so cost math is well-defined but obviously stub.
  return { modelId, inputPerM: 0, outputPerM: 0 };
}

/**
 * Compute USD cost for one completion.
 * Pricing is per-1M-tokens, so divide token counts by 1e6 before multiplying.
 */
export function computeCostUSD(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): { inputCostUSD: number; outputCostUSD: number; totalCostUSD: number } {
  const p = priceFor(modelId);
  const inputCostUSD = (promptTokens / 1_000_000) * p.inputPerM;
  const outputCostUSD = (completionTokens / 1_000_000) * p.outputPerM;
  return {
    inputCostUSD,
    outputCostUSD,
    totalCostUSD: inputCostUSD + outputCostUSD,
  };
}
