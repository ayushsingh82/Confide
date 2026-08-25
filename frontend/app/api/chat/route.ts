import { NextResponse } from "next/server";
import type { ChatRequestBody, ChatResponseBody, Receipt } from "@/lib/types";

// Backend shape — see backend/src/types/index.ts. Kept local (not imported)
// since frontend and backend are separate packages.
interface BackendReceipt {
  id: string;
  model: string;
  latencyMs: number;
  finishReason?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  requestId?: string;
  attestation: { tee?: string; hash?: string; attested: boolean };
  mocked: boolean;
  signature?: Receipt["signature"];
  raw?: unknown;
}

interface BackendChatResponseBody {
  reply: string;
  receipt: BackendReceipt;
  usageEventId?: string;
}

const BACKEND_BASE = (
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  "http://localhost:4000"
).replace(/\/$/, "");

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

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_BASE}/v1/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, messages }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return NextResponse.json(
      { error: `Failed to reach Confide backend: ${message}` },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    let detail = text.slice(0, 2000);
    let error = `Backend ${upstream.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: string; detail?: string };
      if (parsed.error) error = parsed.error;
      if (parsed.detail) detail = parsed.detail;
    } catch {
      // non-JSON error body — fall back to raw text above
    }
    return NextResponse.json({ error, detail }, { status: upstream.status });
  }

  let data: BackendChatResponseBody;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Backend returned non-JSON response", detail: text.slice(0, 2000) },
      { status: 502 }
    );
  }

  // Flatten the backend's nested `attestation` object into the flat Receipt
  // shape the Scanner UI / usage tracker / verifier already consume.
  const r = data.receipt;
  const receipt: Receipt = {
    model: r.model,
    latencyMs: r.latencyMs,
    finishReason: r.finishReason,
    usage: r.usage,
    requestId: r.requestId,
    tee: r.attestation.tee,
    attestationHash: r.attestation.hash,
    attested: r.attestation.attested,
    mocked: r.mocked,
    signature: r.signature,
    raw: r.raw,
  };

  return NextResponse.json<ChatResponseBody>({ reply: data.reply, receipt });
}
