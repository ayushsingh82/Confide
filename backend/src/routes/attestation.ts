import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hasNearKey } from "@/config.js";
import { fetchAttestation, NearError } from "@/lib/attestation.js";

export async function attestationRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/attestation/report?nonce=<hex>&includeTls=true
   * Pull a fresh attestation receipt from NEAR's gateway.
   */
  app.get("/v1/attestation/report", async (req, reply) => {
    if (!hasNearKey) {
      return reply.code(503).send({
        error: "NEAR_API_KEY not configured",
        hint: "Set NEAR_API_KEY in backend/.env and restart.",
      });
    }
    const query = z
      .object({
        nonce: z
          .string()
          .regex(/^[0-9a-fA-F]{0,128}$/, "nonce must be hex")
          .optional(),
        includeTls: z
          .union([z.literal("true"), z.literal("false")])
          .optional(),
      })
      .safeParse(req.query);
    if (!query.success) {
      return reply.code(400).send({ error: "Invalid query", issues: query.error.issues });
    }

    try {
      const opts: Parameters<typeof fetchAttestation>[0] = {
        includeTlsFingerprint: query.data.includeTls !== "false",
      };
      if (query.data.nonce) opts.nonce = query.data.nonce;
      const view = await fetchAttestation(opts);
      return view;
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
}
