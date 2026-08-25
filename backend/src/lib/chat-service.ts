/**
 * Shared NEAR chat-completion + signed-receipt logic.
 *
 * Extracted so routes/chat.ts (the /v1/chat REST endpoint) and
 * sandbox-agent-protocol.ts (the chat.complete WS frame, used by the
 * playground's ChatPanel) build byte-identical Receipt shapes instead of
 * two copies that can drift apart.
 */

import crypto from "node:crypto";
import { chatCompletion, getSignature } from "@/lib/near.js";
import type { ChatRequestBody, Receipt, ReceiptSignature } from "@/types/index.js";

export interface ChatCompletionResult {
  reply: string;
  receipt: Receipt;
}

export async function runChatCompletion(body: ChatRequestBody): Promise<ChatCompletionResult> {
  const { data, latencyMs } = await chatCompletion(body);
  const choice = data.choices?.[0];
  const reply = choice?.message?.content ?? "";
  const id = data.id ?? crypto.randomUUID();

  // NEAR does not embed the attestation receipt in the chat response body.
  // Pull it from /v1/signature/{chat_id} — best-effort, an unsigned receipt
  // still carries the model output if this 2nd hop fails.
  let signature: ReceiptSignature | undefined;
  const rawSignature = data.id ? await getSignature(data.id) : undefined;
  if (rawSignature?.text && rawSignature.signature && rawSignature.signing_address) {
    const parts = rawSignature.text.split(":");
    const responseHash = parts.pop() ?? "";
    const requestHash = parts.pop() ?? "";
    signature = {
      sig: rawSignature.signature,
      signingAddress: rawSignature.signing_address,
      signingAlgo: rawSignature.signing_algo ?? "ecdsa",
      text: rawSignature.text,
      requestHash,
      responseHash,
    };
  }

  const receipt: Receipt = {
    id,
    model: data.model ?? body.model,
    latencyMs,
    attestation: { attested: Boolean(signature) },
    mocked: false,
    raw: { completion: data, signature: rawSignature },
  };
  if (choice?.finish_reason) receipt.finishReason = choice.finish_reason;
  if (data.usage) {
    receipt.usage = {
      promptTokens: data.usage.prompt_tokens ?? 0,
      completionTokens: data.usage.completion_tokens ?? 0,
      totalTokens:
        data.usage.total_tokens ??
        (data.usage.prompt_tokens ?? 0) + (data.usage.completion_tokens ?? 0),
    };
  }
  receipt.requestId = data.id ?? id;
  if (signature) {
    receipt.attestation.tee = "Intel TDX";
    receipt.attestation.hash = signature.responseHash;
    receipt.signature = signature;
  }

  return { reply, receipt };
}
