import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  aggregate,
  bucketByDay,
  leaderboardByModel,
  readEvents,
} from "@/lib/usage-store.js";

const RangeSchema = z.enum(["24h", "7d", "30d", "90d"]).optional();

export async function usageRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/usage/events?range=30d&model=...&limit=100
   * Raw event list. Pagination is intentionally simple — limit only.
   */
  app.get("/v1/usage/events", async (req, reply) => {
    const query = z
      .object({
        range: RangeSchema,
        model: z.string().optional(),
        limit: z.coerce.number().int().positive().max(10_000).optional(),
      })
      .safeParse(req.query);
    if (!query.success) {
      return reply.code(400).send({ error: "Invalid query", issues: query.error.issues });
    }
    const opts: Parameters<typeof readEvents>[0] = {};
    if (query.data.range) opts.range = query.data.range;
    if (query.data.model) opts.model = query.data.model;
    if (query.data.limit !== undefined) opts.limit = query.data.limit;
    const events = readEvents(opts);
    return { count: events.length, events };
  });

  /**
   * GET /v1/usage/summary?range=30d&model=...
   * Pre-aggregated totals + by-day buckets + per-model leaderboard.
   * One call covers everything the /usage UI needs.
   */
  app.get("/v1/usage/summary", async (req, reply) => {
    const query = z
      .object({
        range: RangeSchema,
        model: z.string().optional(),
      })
      .safeParse(req.query);
    if (!query.success) {
      return reply.code(400).send({ error: "Invalid query", issues: query.error.issues });
    }
    const opts: Parameters<typeof readEvents>[0] = {};
    if (query.data.range) opts.range = query.data.range;
    if (query.data.model) opts.model = query.data.model;
    const events = readEvents(opts);
    return {
      range: query.data.range ?? "all",
      totals: aggregate(events),
      byDay: bucketByDay(events),
      leaderboard: leaderboardByModel(events),
    };
  });
}
