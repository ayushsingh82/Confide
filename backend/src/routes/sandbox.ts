import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getSandbox, listSandboxes } from "@/lib/sandbox-store.js";
import { getProvider } from "@/lib/cvm-provider.js";
import {
  listTree,
  readFile,
  SandboxFsError,
  writeFile,
} from "@/lib/sandbox-fs.js";
import { ExecError, runCommand } from "@/lib/sandbox-exec.js";

const GITHUB_URL = /^https?:\/\/(www\.)?github\.com\/[^\/]+\/[^\/?#]+/;

const SpawnBody = z.object({
  repoUrl: z
    .string()
    .url("repoUrl must be a valid URL")
    .regex(GITHUB_URL, "Only github.com URLs are accepted"),
  ttlMs: z.number().int().positive().max(2 * 60 * 60 * 1000).optional(),
});

const ReadQuery = z.object({ path: z.string().min(1) });
const WriteBody = z.object({
  path: z.string().min(1),
  contents: z.string(),
});
const ExecBody = z.object({
  cmd: z.string().min(1),
  args: z.array(z.string()).default([]),
  cwd: z.string().optional(),
  timeoutMs: z.number().int().positive().max(5 * 60 * 1000).optional(),
});

function readyOr404(id: string) {
  const session = getSandbox(id);
  if (!session) return { error: { status: 404, message: "Sandbox not found" } };
  if (session.status !== "ready") {
    return {
      error: {
        status: 409,
        message: `Sandbox not ready (status: ${session.status})`,
      },
    };
  }
  return { session };
}

export async function sandboxRoutes(app: FastifyInstance): Promise<void> {
  /** POST /v1/sandbox — spawn a new sandbox for a GitHub repo. */
  app.post("/v1/sandbox", async (req, reply) => {
    const parsed = SpawnBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid body", issues: parsed.error.issues });
    }
    try {
      const session = await getProvider().spawn({
        repoUrl: parsed.data.repoUrl,
        // Unused by MockProvider; real providers pin the published
        // confide-cvm image digest here once one exists (plan.md §12.A).
        imageDigest: "local-mock",
        ttlMs: parsed.data.ttlMs,
      });
      return reply.code(201).send(session);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.code(503).send({ error: message });
    }
  });

  /** GET /v1/sandbox/:id — poll for status. */
  app.get<{ Params: { id: string } }>("/v1/sandbox/:id", async (req, reply) => {
    const session = getSandbox(req.params.id);
    if (!session) return reply.code(404).send({ error: "Sandbox not found" });
    return session;
  });

  /** DELETE /v1/sandbox/:id — destroy + wipe workspace. */
  app.delete<{ Params: { id: string } }>(
    "/v1/sandbox/:id",
    async (req, reply) => {
      if (!getSandbox(req.params.id)) {
        return reply.code(404).send({ error: "Sandbox not found" });
      }
      await getProvider().destroy(req.params.id);
      return reply.code(204).send();
    }
  );

  /** GET /v1/sandbox — list all sessions (debug). */
  app.get("/v1/sandbox", async () => {
    const sessions = listSandboxes();
    return { count: sessions.length, sessions };
  });

  /** GET /v1/sandbox/:id/tree — recursive file tree. */
  app.get<{ Params: { id: string } }>(
    "/v1/sandbox/:id/tree",
    async (req, reply) => {
      const r = readyOr404(req.params.id);
      if (r.error) return reply.code(r.error.status).send({ error: r.error.message });
      try {
        const tree = await listTree(req.params.id);
        return { tree };
      } catch (err) {
        if (err instanceof SandboxFsError) {
          return reply.code(err.status).send({ error: err.message });
        }
        const m = err instanceof Error ? err.message : "Unknown error";
        return reply.code(500).send({ error: m });
      }
    }
  );

  /** GET /v1/sandbox/:id/file?path=src/app.ts */
  app.get<{ Params: { id: string } }>(
    "/v1/sandbox/:id/file",
    async (req, reply) => {
      const r = readyOr404(req.params.id);
      if (r.error) return reply.code(r.error.status).send({ error: r.error.message });
      const q = ReadQuery.safeParse(req.query);
      if (!q.success) return reply.code(400).send({ error: "Invalid query" });
      try {
        const result = await readFile(req.params.id, q.data.path);
        return result;
      } catch (err) {
        if (err instanceof SandboxFsError) {
          return reply.code(err.status).send({ error: err.message });
        }
        const m = err instanceof Error ? err.message : "Unknown error";
        return reply.code(500).send({ error: m });
      }
    }
  );

  /** PUT /v1/sandbox/:id/file — body { path, contents } */
  app.put<{ Params: { id: string } }>(
    "/v1/sandbox/:id/file",
    async (req, reply) => {
      const r = readyOr404(req.params.id);
      if (r.error) return reply.code(r.error.status).send({ error: r.error.message });
      const b = WriteBody.safeParse(req.body);
      if (!b.success) {
        return reply
          .code(400)
          .send({ error: "Invalid body", issues: b.error.issues });
      }
      try {
        const result = await writeFile(req.params.id, b.data.path, b.data.contents);
        return result;
      } catch (err) {
        if (err instanceof SandboxFsError) {
          return reply.code(err.status).send({ error: err.message });
        }
        const m = err instanceof Error ? err.message : "Unknown error";
        return reply.code(500).send({ error: m });
      }
    }
  );

  /** POST /v1/sandbox/:id/exec — run a command synchronously inside the workspace. */
  app.post<{ Params: { id: string } }>(
    "/v1/sandbox/:id/exec",
    async (req, reply) => {
      const r = readyOr404(req.params.id);
      if (r.error) return reply.code(r.error.status).send({ error: r.error.message });
      const b = ExecBody.safeParse(req.body);
      if (!b.success) {
        return reply
          .code(400)
          .send({ error: "Invalid body", issues: b.error.issues });
      }
      try {
        const opts: Parameters<typeof runCommand>[3] = {};
        if (b.data.timeoutMs !== undefined) opts.timeoutMs = b.data.timeoutMs;
        if (b.data.cwd !== undefined) opts.cwd = b.data.cwd;
        const result = await runCommand(
          req.params.id,
          b.data.cmd,
          b.data.args,
          opts
        );
        return result;
      } catch (err) {
        if (err instanceof ExecError) {
          return reply.code(err.status).send({ error: err.message });
        }
        const m = err instanceof Error ? err.message : "Unknown error";
        return reply.code(500).send({ error: m });
      }
    }
  );
}
