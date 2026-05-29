import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createSandbox,
  destroySandbox,
  getSandbox,
  listSandboxes,
} from "@/lib/sandbox-store.js";

const GITHUB_URL = /^https?:\/\/(www\.)?github\.com\/[^\/]+\/[^\/?#]+/;

const SpawnBody = z.object({
  repoUrl: z
    .string()
    .url("repoUrl must be a valid URL")
    .regex(GITHUB_URL, "Only github.com URLs are accepted"),
  ttlMs: z.number().int().positive().max(2 * 60 * 60 * 1000).optional(),
});

export async function sandboxRoutes(app: FastifyInstance): Promise<void> {
  /** POST /v1/sandbox — spawn a new sandbox VM for a GitHub repo. */
  app.post("/v1/sandbox", async (req, reply) => {
    const parsed = SpawnBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid body", issues: parsed.error.issues });
    }
    const session = createSandbox(parsed.data.repoUrl, parsed.data.ttlMs);
    return reply.code(201).send(session);
  });

  /** GET /v1/sandbox/:id — poll for status. */
  app.get<{ Params: { id: string } }>("/v1/sandbox/:id", async (req, reply) => {
    const session = getSandbox(req.params.id);
    if (!session) return reply.code(404).send({ error: "Sandbox not found" });
    return session;
  });

  /** DELETE /v1/sandbox/:id — destroy. */
  app.delete<{ Params: { id: string } }>(
    "/v1/sandbox/:id",
    async (req, reply) => {
      const ok = destroySandbox(req.params.id);
      if (!ok) return reply.code(404).send({ error: "Sandbox not found" });
      return reply.code(204).send();
    }
  );

  /** GET /v1/sandbox — list all sessions (debug + future admin UI). */
  app.get("/v1/sandbox", async () => {
    const sessions = listSandboxes();
    return { count: sessions.length, sessions };
  });
}
