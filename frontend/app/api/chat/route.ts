import { NextResponse } from "next/server";
import type { ChatRequestBody, ChatResponseBody, Receipt } from "@/lib/types";

const NEAR_BASE = process.env.NEAR_API_BASE ?? "https://cloud-api.near.ai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { model, messages } = body;
  if (!model || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "Body must include `model` and a non-empty `messages` array" },
      { status: 400 }
    );
  }

  const apiKey = process.env.NEAR_API_KEY;

  // No key yet → return a stub so the UI is still demoable.
  if (!apiKey) {
    const reply =
      "🔒 Stub response — set NEAR_API_KEY in frontend/.env.local to route this through a real TEE on NEAR AI Cloud.";
    const receipt: Receipt = {
      model,
      latencyMs: 0,
      finishReason: "stub",
      attested: false,
      mocked: true,
    };
    return NextResponse.json<ChatResponseBody>({ reply, receipt });
  }

  const started = Date.now();
  let upstream: Response;
  try {
    upstream = await fetch(`${NEAR_BASE}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: false }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return NextResponse.json(
      { error: `Failed to reach NEAR AI Cloud: ${message}` },
      { status: 502 }
    );
  }

  const latencyMs = Date.now() - started;
  const text = await upstream.text();

  if (!upstream.ok) {
    return NextResponse.json(
      {
        error: `NEAR upstream ${upstream.status}`,
        detail: text.slice(0, 2000),
      },
      { status: upstream.status }
    );
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "NEAR returned non-JSON response", detail: text.slice(0, 2000) },
      { status: 502 }
    );
  }

  const choices = (data.choices ?? []) as Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  const reply = choices[0]?.message?.content ?? "";
  const finishReason = choices[0]?.finish_reason;

  const usage = data.usage as
    | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    | undefined;

  const chatId = (data.id as string) ?? upstream.headers.get("x-request-id") ?? undefined;

  // NEAR does not embed the attestation receipt in the chat response body.
  // Pull it from /v1/signature/{chat_id} — the gateway signs every completion
  // inside its TEE and caches the signature. Best-effort: if this 2nd hop
  // fails we still return the reply with an unsigned receipt rather than
  // erroring the whole call.
  let signature: Receipt["signature"];
  let signaturePayload: unknown;
  if (chatId) {
    try {
      const sigRes = await fetch(
        `${NEAR_BASE}/v1/signature/${encodeURIComponent(chatId)}`,
        { headers: { authorization: `Bearer ${apiKey}` } }
      );
      if (sigRes.ok) {
        const sigData = (await sigRes.json()) as {
          text?: string;
          signature?: string;
          signing_address?: string;
          signing_algo?: string;
        };
        signaturePayload = sigData;
        if (sigData.text && sigData.signature && sigData.signing_address) {
          // text = `${modelName}:${requestSha256}:${responseSha256}`
          // model name can contain `/` but never `:`, so the last two
          // colon-separated parts are always the hashes.
          const parts = sigData.text.split(":");
          const responseHash = parts.pop() ?? "";
          const requestHash = parts.pop() ?? "";
          signature = {
            sig: sigData.signature,
            signingAddress: sigData.signing_address,
            signingAlgo: sigData.signing_algo ?? "ecdsa",
            text: sigData.text,
            requestHash,
            responseHash,
          };
        }
      }
    } catch {
      // Network blip — leave signature undefined; the receipt still carries
      // the model output. The Scanner will show "Completed (no signature)".
    }
  }

  const receipt: Receipt = {
    model: (data.model as string) ?? model,
    latencyMs,
    finishReason,
    usage: usage
      ? {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        }
      : undefined,
    requestId: chatId,
    // NEAR's gateway runs every completion in an Intel TDX confidential VM
    // — fixed across this account, so we can label it once we have a sig.
    tee: signature ? "Intel TDX" : undefined,
    attestationHash: signature?.responseHash,
    attested: Boolean(signature),
    mocked: false,
    signature,
    raw: { completion: data, signature: signaturePayload },
  };

  return NextResponse.json<ChatResponseBody>({ reply, receipt });
}
