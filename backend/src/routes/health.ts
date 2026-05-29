import type { FastifyInstance } from "fastify";
import { hasNearKey } from "@/config.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/health", async () => ({
    ok: true,
    service: "confide-backend",
    version: "0.1.0",
    nearKeyConfigured: hasNearKey,
    ts: Date.now(),
  }));
}
