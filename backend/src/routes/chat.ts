import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { z } from "zod";
import { hasNearKey } from "@/config.js";
import { NearError } from "@/lib/near.js";
import { runChatCompletion } from "@/lib/chat-service.js";
import { appendFromReceipt } from "@/lib/usage-store.js";
import type { ChatResponseBody, Receipt } from "@/types/index.js";

const ChatBody = z.object({
  model: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    )
    .min(1),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  max_tokens: z.number().int().positive().optional(),
  stop: z.array(z.string()).optional(),
  chat_template_kwargs: z.record(z.unknown()).optional(),
});

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/chat", async (req, reply) => {
    const parsed = ChatBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid request body",
        issues: parsed.error.issues,
      });
    }
    const body = parsed.data;

    if (!hasNearKey) {
      const stubReceipt: Receipt = {
        id: crypto.randomUUID(),
        model: body.model,
        latencyMs: 0,
        finishReason: "stub",
        attestation: { attested: false },
        mocked: true,
      };
      const stubResponse: ChatResponseBody = {
        reply:
          "🔒 Stub response — set NEAR_API_KEY in backend/.env to route through a real TEE on NEAR AI Cloud.",
        receipt: stubReceipt,
      };
      return reply.send(stubResponse);
    }

    try {
      const { reply: replyText, receipt } = await runChatCompletion(body);
      const event = appendFromReceipt(receipt);
      const response: ChatResponseBody = { reply: replyText, receipt };
      if (event) response.usageEventId = event.id;
      return reply.send(response);
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
