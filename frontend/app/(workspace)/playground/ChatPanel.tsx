"use client";

import { useEffect, useRef, useState } from "react";
import { AVAILABLE_MODELS } from "@/lib/types";
import type { Message, Receipt } from "@/lib/types";
import { api, type LiveModel } from "@/lib/api";
import { verifyReceipt, type VerifyResult } from "@/lib/verify";
import type { SandboxBridge } from "./SandboxBridge";

/**
 * Chat panel inside the sandbox — routes through bridge.chat.complete
 * instead of fetch("/api/chat"), so prompts go browser -> agent -> NEAR
 * without touching the Confide backend's HTTP proxy. Same Receipt shape as
 * /chat, so the same verifier (lib/verify.ts) works unchanged.
 */

interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
  receipt?: Receipt;
  error?: string;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function shortHash(h?: string): string {
  if (!h) return "—";
  return h.length <= 12 ? h : `${h.slice(0, 6)}…${h.slice(-4)}`;
}

export function ChatPanel({ bridge }: { bridge: SandboxBridge }) {
  const [models, setModels] = useState<LiveModel[]>(AVAILABLE_MODELS);
  const [model, setModel] = useState(AVAILABLE_MODELS[0].id);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .models()
      .then((live) => {
        if (live.length === 0) return;
        setModels(live);
        setModel((current) => (live.some((m) => m.id === current) ? current : live[0].id));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, pending]);

  const lastReceipt = [...turns].reverse().find((t) => t.receipt)?.receipt;

  async function send(): Promise<void> {
    const trimmed = input.trim();
    if (!trimmed || pending) return;
    const userTurn: Turn = { id: uid(), role: "user", content: trimmed };
    const history: Message[] = [...turns, userTurn].map((t) => ({ role: t.role, content: t.content }));
    setTurns((t) => [...t, userTurn]);
    setInput("");
    setPending(true);
    setVerifyResult(null);
    try {
      const { reply, receipt } = await bridge.chat.complete(model, history);
      setTurns((t) => [...t, { id: uid(), role: "assistant", content: reply, receipt }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setTurns((t) => [...t, { id: uid(), role: "assistant", content: "", error: message }]);
    } finally {
      setPending(false);
    }
  }

  async function runVerify(): Promise<void> {
    if (!lastReceipt) return;
    setVerifying(true);
    try {
      setVerifyResult(await verifyReceipt(lastReceipt));
    } catch (err) {
      setVerifyResult({
        ok: false,
        reason: err instanceof Error ? err.message : "Verification error",
        attempts: [],
      });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-900 px-3 py-2">
        <label className="text-[0.65rem] text-neutral-500">Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="flex-1 truncate rounded border border-neutral-800 bg-black px-2 py-1 text-[0.7rem] text-white focus:border-neutral-600 focus:outline-none"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {turns.length === 0 && !pending && (
          <p className="px-1 text-xs leading-relaxed text-neutral-500">
            Chat here routes through the sandbox agent — prompts never touch the Confide backend's HTTP
            proxy, only the WS bridge.
          </p>
        )}
        <div className="space-y-3">
          {turns.map((t) => (
            <div key={t.id} className={t.role === "user" ? "flex justify-end" : ""}>
              {t.role === "user" ? (
                <div className="max-w-[85%] whitespace-pre-wrap rounded-xl bg-white px-3 py-1.5 text-xs text-black">
                  {t.content}
                </div>
              ) : t.error ? (
                <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                  {t.error}
                </div>
              ) : (
                <div className="rounded-lg border border-neutral-900 bg-neutral-950 px-3 py-2 text-xs leading-relaxed text-neutral-200">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-mono text-[0.6rem] uppercase tracking-widest text-neutral-500">
                      {t.receipt?.mocked ? "Stub" : t.receipt?.attested ? "Attested ✓" : "Reply"}
                    </span>
                    {t.receipt && (
                      <span className="font-mono text-[0.6rem] text-neutral-600">
                        {t.receipt.latencyMs}ms
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap">{t.content}</div>
                </div>
              )}
            </div>
          ))}
          {pending && (
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Routing through the sandbox agent…
            </div>
          )}
        </div>
      </div>

      {lastReceipt?.signature && (
        <div className="shrink-0 border-t border-neutral-900 bg-black px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[0.6rem] text-neutral-500">
              sig {shortHash(lastReceipt.signature.responseHash)}
            </span>
            <button
              type="button"
              onClick={() => void runVerify()}
              disabled={verifying}
              className="rounded-full border border-emerald-700/60 bg-emerald-900/30 px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-900/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {verifying ? "Verifying…" : verifyResult?.ok ? "Re-verify" : "Verify"}
            </button>
          </div>
          {verifyResult && (
            <p className={`mt-1 text-[0.6rem] ${verifyResult.ok ? "text-emerald-300" : "text-amber-300"}`}>
              {verifyResult.ok ? `✓ Signature valid via ${verifyResult.scheme}` : `⚠ ${verifyResult.reason}`}
            </p>
          )}
        </div>
      )}

      <div className="shrink-0 border-t border-neutral-900 bg-black p-2">
        <div className="flex items-end gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="Ask about this code…"
            className="flex-1 resize-none bg-transparent text-xs text-white placeholder:text-neutral-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={pending || !input.trim()}
            className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[0.65rem] font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {pending ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
