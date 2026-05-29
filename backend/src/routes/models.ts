import type { FastifyInstance } from "fastify";
import { hasNearKey } from "@/config.js";
import { listModels, NearError } from "@/lib/near.js";
import { PRICING } from "@/lib/pricing.js";

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { fetchedAt: number; data: unknown } | null = null;

export async function modelsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/models — proxy the upstream catalog with a short in-process cache.
   * Falls back to our static pricing table if NEAR isn't reachable.
   */
  app.get("/v1/models", async (_req, reply) => {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      return { cached: true, data: cache.data };
    }

    if (!hasNearKey) {
      const data = Object.values(PRICING).map((p) => ({
        id: p.modelId,
        owned_by: "near",
        pricing: { input: p.inputPerM, output: p.outputPerM },
      }));
      return { cached: false, fallback: true, data };
    }

    try {
      const data = await listModels();
      cache = { fetchedAt: Date.now(), data };
      return { cached: false, data };
    } catch (err) {
      if (err instanceof NearError) {
        return reply
          .code(err.status >= 400 && err.status < 600 ? err.status : 502)
          .send({ error: err.message, detail: err.detail });
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.code(500).send({ error: message });
    }
  });

  /** GET /v1/models/pricing — local pricing table (no upstream call). */
  app.get("/v1/models/pricing", async () => ({
    count: Object.keys(PRICING).length,
    data: Object.values(PRICING),
  }));
}
