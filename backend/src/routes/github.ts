import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getSession } from "@/lib/session-store.js";
import { GithubError, listUserRepos } from "@/lib/github.js";

const COOKIE_NAME = "confide.sid";

export async function githubRoutes(app: FastifyInstance): Promise<void> {
  /** GET /v1/github/repos?per_page=30&sort=updated */
  app.get("/v1/github/repos", async (req, reply) => {
    const session = getSession(req.cookies[COOKIE_NAME]);
    if (!session) {
      return reply.code(401).send({ error: "Not authenticated" });
    }
    const query = z
      .object({
        per_page: z.coerce.number().int().positive().max(100).optional(),
        sort: z
          .enum(["updated", "pushed", "created", "full_name"])
          .optional(),
      })
      .safeParse(req.query);
    if (!query.success) {
      return reply.code(400).send({ error: "Invalid query" });
    }
    try {
      const opts: Parameters<typeof listUserRepos>[1] = {};
      if (query.data.per_page !== undefined) opts.perPage = query.data.per_page;
      if (query.data.sort) opts.sort = query.data.sort;
      const repos = await listUserRepos(session.accessToken, opts);
      return { count: repos.length, repos };
    } catch (err) {
      if (err instanceof GithubError) {
        return reply.code(err.status).send({ error: err.message, detail: err.detail });
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.code(500).send({ error: message });
    }
  });
}
