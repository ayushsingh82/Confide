"use client";

import { useEffect, useRef, useState } from "react";
import { TopBar } from "@/app/components/workspace/TopBar";
import { AVAILABLE_MODELS } from "@/lib/types";
import type { ChatResponseBody, Message, Receipt } from "@/lib/types";
import { logUsage, receiptToEvent } from "@/lib/usage";
import { verifyReceipt, type VerifyResult } from "@/lib/verify";
import { api, type LiveModel } from "@/lib/api";

interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
  receipt?: Receipt;
  error?: string;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function shortHash(h?: string) {
  if (!h) return "—";
  if (h.length <= 12) return h;
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

export function ChatWorkspace() {
  const [models, setModels] = useState<LiveModel[]>(AVAILABLE_MODELS);
  const [model, setModel] = useState(AVAILABLE_MODELS[0].id);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, pending]);

  // Swap the hardcoded picker for NEAR's live, ready-only catalog once it
  // loads. Falls back to AVAILABLE_MODELS (already the initial state) on
  // any network/backend error, so the picker is never empty.
  useEffect(() => {
    let cancelled = false;
    api
      .models()
      .then((live) => {
        if (cancelled || live.length === 0) return;
        setModels(live);
        setModel((current) => (live.some((m) => m.id === current) ? current : live[0].id));
      })
      .catch(() => {
        // Keep the static fallback list.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeReceipt =
    turns.find((t) => t.id === activeReceiptId)?.receipt ??
    [...turns].reverse().find((t) => t.receipt)?.receipt;

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || pending) return;

    const userTurn: Turn = { id: uid(), role: "user", content: trimmed };
    setTurns((t) => [...t, userTurn]);
    setInput("");
    setPending(true);

    const history: Message[] = [...turns, userTurn].map((t) => ({
      role: t.role,
      content: t.content,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, messages: history }),
      });
      const data = (await res.json()) as ChatResponseBody | { error: string };

      if (!res.ok || "error" in data) {
        const err = "error" in data ? data.error : `HTTP ${res.status}`;
        setTurns((t) => [
          ...t,
          { id: uid(), role: "assistant", content: "", error: err },
        ]);
      } else {
        const id = uid();
        setTurns((t) => [
          ...t,
          { id, role: "assistant", content: data.reply, receipt: data.receipt },
        ]);
        setActiveReceiptId(id);
        const event = receiptToEvent(data.receipt);
        if (event) logUsage(event);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setTurns((t) => [
        ...t,
        { id: uid(), role: "assistant", content: "", error: message },
      ]);
    } finally {
      setPending(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="flex h-full flex-col bg-black text-white">
      <TopBar
        rightSlot={
          <>
            <label className="hidden text-xs text-neutral-500 sm:block">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="rounded-md border border-neutral-800 bg-black px-3 py-1.5 text-sm text-white focus:border-neutral-600 focus:outline-none"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </>
        }
      />

      {/* Two-pane layout */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Chat */}
        <section className="flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-6 sm:px-8"
          >
            {turns.length === 0 && !pending && (
              <EmptyState />
            )}
            <div className="mx-auto max-w-3xl space-y-6">
              {turns.map((turn) => (
                <TurnView
                  key={turn.id}
                  turn={turn}
                  isActive={turn.id === activeReceiptId}
                  onSelect={() =>
                    turn.receipt ? setActiveReceiptId(turn.id) : undefined
                  }
                />
              ))}
              {pending && (
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Routing through TEE…
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-neutral-900 bg-black px-4 py-4 sm:px-8">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-end gap-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-3 focus-within:border-neutral-600">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKey}
                  rows={2}
                  placeholder="Ask the IDE — your prompt runs inside a TEE…"
                  className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-neutral-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={pending || !input.trim()}
                  className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
                >
                  {pending ? "…" : "Send"}
                </button>
              </div>
              <p className="mt-2 text-center text-[0.65rem] uppercase tracking-[0.25em] text-neutral-600">
                Cmd / Ctrl + Enter to send
              </p>
            </div>
          </div>
        </section>

        {/* Scanner */}
        <aside className="flex w-full shrink-0 flex-col border-t border-neutral-900 bg-neutral-950 md:w-[360px] md:border-l md:border-t-0">
          <ScannerPanel receipt={activeReceipt} />
        </aside>
      </div>
    </div>
  );
}

function EmptyState() {
  const samples = [
    "Write a SQL migration that adds a NOT NULL column with a backfill default.",
    "Explain how Intel TDX attestation works in plain English.",
    "Review this auth middleware for token-leak risks.",
  ];
  return (
    <div className="mx-auto max-w-2xl py-12 text-center">
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.25em] text-neutral-600">
        New workspace
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        Ask anything. <span className="font-serif italic">Verify</span> everything.
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-neutral-400">
        Every prompt routes to a confidential enclave on NEAR AI Cloud and comes
        back with an attestation receipt in the Scanner panel.
      </p>
      <div className="mt-10 grid gap-2 text-left">
        {samples.map((s) => (
          <div
            key={s}
            className="rounded-xl border border-neutral-900 bg-black px-4 py-3 text-sm text-neutral-400"
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

function TurnView({
  turn,
  isActive,
  onSelect,
}: {
  turn: Turn;
  isActive: boolean;
  onSelect: () => void;
}) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-white px-4 py-2.5 text-sm text-black">
          {turn.content}
        </div>
      </div>
    );
  }

  if (turn.error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
        <span className="font-mono text-[0.65rem] uppercase tracking-widest text-red-400">
          Error
        </span>
        <div className="mt-1 whitespace-pre-wrap">{turn.error}</div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={`cursor-pointer rounded-2xl border px-4 py-3 text-sm leading-relaxed text-neutral-200 transition ${
        isActive
          ? "border-neutral-700 bg-neutral-900"
          : "border-neutral-900 bg-neutral-950 hover:border-neutral-800"
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-[0.65rem] uppercase tracking-widest text-neutral-500">
          {turn.receipt?.mocked ? "Stub" : turn.receipt?.attested ? "Attested ✓" : "Reply"}
        </span>
        {turn.receipt && (
          <span className="font-mono text-[0.65rem] text-neutral-600">
            {turn.receipt.model} · {turn.receipt.latencyMs}ms
          </span>
        )}
      </div>
      <div className="whitespace-pre-wrap">{turn.content}</div>
    </div>
  );
}

function ScannerPanel({ receipt }: { receipt: Receipt | undefined }) {
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  // Reset verification state whenever the active receipt changes.
  const requestId = receipt?.requestId;
  useEffect(() => {
    setVerifyResult(null);
    setVerifying(false);
  }, [requestId]);

  async function runVerify() {
    if (!receipt) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const result = await verifyReceipt(receipt);
      setVerifyResult(result);
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
      <div className="flex h-14 shrink-0 items-center border-b border-neutral-900 px-5">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-neutral-500">
          Scanner
        </span>
        <span className="ml-auto flex items-center gap-2 text-[0.7rem] text-neutral-500">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              receipt?.attested
                ? "bg-emerald-400"
                : receipt?.mocked
                ? "bg-amber-400"
                : "bg-neutral-700"
            }`}
          />
          {receipt?.attested
            ? "attested"
            : receipt?.mocked
            ? "stub (no key)"
            : "idle"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {!receipt ? (
          <div className="text-sm text-neutral-500">
            Send a prompt to see its attestation receipt here.
          </div>
        ) : (
          <dl className="space-y-4 text-sm">
            <Row label="Model" value={receipt.model} />
            <Row
              label="Status"
              value={
                receipt.mocked
                  ? "Stub response (NEAR_API_KEY not set)"
                  : receipt.attested
                  ? "Attested ✓ — signed inside TEE"
                  : "Completed (no signature)"
              }
              tone={
                receipt.mocked ? "warn" : receipt.attested ? "ok" : "neutral"
              }
            />
            <Row label="TEE" value={receipt.tee ?? "—"} mono />
            <Row
              label="Response hash"
              value={shortHash(receipt.signature?.responseHash ?? receipt.attestationHash)}
              mono
              fullValue={receipt.signature?.responseHash ?? receipt.attestationHash}
            />
            <Row
              label="Request hash"
              value={shortHash(receipt.signature?.requestHash)}
              mono
              fullValue={receipt.signature?.requestHash}
            />
            <Row
              label="Signing addr"
              value={shortHash(receipt.signature?.signingAddress)}
              mono
              fullValue={receipt.signature?.signingAddress}
            />
            <Row
              label="Sig algo"
              value={receipt.signature?.signingAlgo ?? "—"}
              mono
            />
            {receipt.signature?.text && (
              <Row
                label="Signed payload"
                value={`${receipt.signature.text.slice(0, 22)}…`}
                mono
                fullValue={receipt.signature.text}
              />
            )}
            <Row label="Request ID" value={receipt.requestId ?? "—"} mono />
            <Row
              label="Latency"
              value={`${receipt.latencyMs.toLocaleString()} ms`}
              mono
            />
            <Row label="Finish" value={receipt.finishReason ?? "—"} mono />
            <Row
              label="Tokens"
              value={
                receipt.usage
                  ? `${receipt.usage.promptTokens ?? "?"} in · ${
                      receipt.usage.completionTokens ?? "?"
                    } out`
                  : "—"
              }
              mono
            />
            {receipt.signature?.sig && (
              <details className="rounded-lg border border-emerald-900/40 bg-emerald-950/10 p-3">
                <summary className="flex cursor-pointer items-center justify-between gap-2 text-[0.7rem] uppercase tracking-widest text-emerald-300">
                  <span>Signature</span>
                  <CopyIconButton value={receipt.signature.sig} />
                </summary>
                <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[0.65rem] text-emerald-200/80">
                  {receipt.signature.sig}
                </pre>
              </details>
            )}

            {/* Browser-side verification */}
            {receipt.signature && (
              <div className="rounded-lg border border-neutral-900 bg-black p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[0.7rem] uppercase tracking-widest text-neutral-500">
                    Verify in browser
                  </span>
                  <button
                    type="button"
                    onClick={() => void runVerify()}
                    disabled={verifying}
                    className="rounded-full border border-emerald-700/60 bg-emerald-900/30 px-3 py-1 text-[0.65rem] font-medium uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-900/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {verifying
                      ? "Verifying…"
                      : verifyResult?.ok
                      ? "Re-verify"
                      : "Verify signature"}
                  </button>
                </div>
                {verifyResult && (
                  <div className="mt-3 space-y-1.5 text-[0.7rem]">
                    {verifyResult.ok ? (
                      <p className="text-emerald-300">
                        ✓ Signature valid via{" "}
                        <span className="font-mono text-emerald-200">
                          {verifyResult.scheme}
                        </span>
                        . Recovered address matches the TEE&apos;s signing key
                        — the model output came from the holder of{" "}
                        <span className="font-mono">
                          {shortHash(receipt.signature.signingAddress)}
                        </span>{" "}
                        and nothing has been altered in transit.
                      </p>
                    ) : (
                      <>
                        <p className="text-amber-300">
                          ⚠ Could not verify: {verifyResult.reason}
                        </p>
                        {verifyResult.attempts.length > 0 && (
                          <div className="space-y-0.5 text-neutral-500">
                            {verifyResult.attempts.map((a) => (
                              <p key={a.scheme}>
                                <span className="font-mono text-neutral-400">
                                  {a.scheme}
                                </span>
                                {" → "}
                                <span className="font-mono">{a.recovered}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                {!verifyResult && (
                  <p className="mt-2 text-[0.65rem] leading-relaxed text-neutral-500">
                    Runs keccak256 + secp256k1 ecrecover entirely in your browser.
                    No round-trip to NEAR or to us — the proof stands or falls
                    on math you can re-run yourself.
                  </p>
                )}
              </div>
            )}
            {receipt.raw !== undefined && (
              <details className="rounded-lg border border-neutral-900 bg-black p-3">
                <summary className="cursor-pointer text-[0.7rem] uppercase tracking-widest text-neutral-500">
                  Raw response
                </summary>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all text-[0.7rem] text-neutral-400">
                  {JSON.stringify(receipt.raw, null, 2)}
                </pre>
              </details>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  tone = "neutral",
  fullValue,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "neutral" | "ok" | "warn";
  /** When provided, surface copy + open-in-tab affordances using this full value. */
  fullValue?: string;
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-300"
      : tone === "warn"
      ? "text-amber-300"
      : "text-neutral-200";
  const showActions =
    typeof fullValue === "string" && fullValue.length > 0 && value !== "—";
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[0.7rem] uppercase tracking-widest text-neutral-500">
        {label}
      </dt>
      <dd
        className={`flex items-center justify-end gap-1 text-right ${
          mono ? "font-mono text-xs" : "text-sm"
        } ${toneClass}`}
      >
        <span>{value}</span>
        {showActions && <CopyIconButton value={fullValue} />}
      </dd>
    </div>
  );
}

function CopyIconButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard blocked — silently no-op
        }
      }}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-neutral-500 transition hover:bg-neutral-900 hover:text-white"
      title={copied ? "Copied" : "Copy"}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? (
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="9" y="9" width="13" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
    </button>
  );
}

