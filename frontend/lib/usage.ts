/**
 * Token usage tracking — browser-local for the MVP.
 *
 * Storage: localStorage key `confide.usage.v1`, a JSON array of UsageEvent.
 * Every successful POST /api/chat round-trip appends one event (see ChatWorkspace).
 *
 * Aggregation runs entirely client-side: the /usage page reads the array,
 * filters by time range, and rolls up totals.
 *
 * Migration path: keep the same UsageEvent shape on the server side. When auth
 * lands, the same events get persisted server-side instead of localStorage.
 */

import { NEAR_MODELS } from "./near-models";
import type { Receipt } from "./types";

export type UsageEvent = {
  id: string;
  /** Unix ms timestamp */
  ts: number;
  /** NEAR model id, e.g. "deepseek-ai/DeepSeek-V3.1" */
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** USD costs computed from NEAR_MODELS pricing */
  inputCostUSD: number;
  outputCostUSD: number;
  totalCostUSD: number;
  /** Wall-clock latency for the round trip */
  latencyMs: number;
  /** Was this a real attested response (vs. a mocked stub)? */
  attested: boolean;
  /** Short receipt id from NEAR, if returned */
  requestId?: string;
};

const STORAGE_KEY = "confide.usage.v1";
const MAX_EVENTS = 1000;

/** Parse strings like "$1.00" / "$0.55" / "—" into USD-per-M-tokens numbers. */
export function parsePerMillion(value: string): number {
  if (!value || value === "—") return 0;
  const n = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Look up the pricing row in NEAR_MODELS for a given model id. */
function priceFor(modelId: string) {
  const row = NEAR_MODELS.find((m) => m.modelId === modelId);
  return {
    inputPerM: parsePerMillion(row?.inputPerM ?? "—"),
    outputPerM: parsePerMillion(row?.outputPerM ?? "—"),
  };
}

/**
 * Build a UsageEvent from the receipt returned by /api/chat.
 * Returns null when the response was a stub (no real tokens to charge).
 */
export function receiptToEvent(receipt: Receipt): UsageEvent | null {
  if (receipt.mocked) return null;
  const promptTokens = receipt.usage?.promptTokens ?? 0;
  const completionTokens = receipt.usage?.completionTokens ?? 0;
  const totalTokens =
    receipt.usage?.totalTokens ?? promptTokens + completionTokens;
  const { inputPerM, outputPerM } = priceFor(receipt.model);
  const inputCostUSD = (promptTokens / 1_000_000) * inputPerM;
  const outputCostUSD = (completionTokens / 1_000_000) * outputPerM;
  return {
    id: receipt.requestId ?? cryptoRandomId(),
    ts: Date.now(),
    model: receipt.model,
    promptTokens,
    completionTokens,
    totalTokens,
    inputCostUSD,
    outputCostUSD,
    totalCostUSD: inputCostUSD + outputCostUSD,
    latencyMs: receipt.latencyMs,
    attested: receipt.attested,
    requestId: receipt.requestId,
  };
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Append one event to localStorage. No-op on the server. */
export function logUsage(event: UsageEvent): void {
  if (typeof window === "undefined") return;
  try {
    const list = readAllEvents();
    list.push(event);
    // Trim to the most-recent MAX_EVENTS to bound localStorage growth.
    const trimmed = list.length > MAX_EVENTS ? list.slice(-MAX_EVENTS) : list;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota or serialization errors — drop silently. Usage is best-effort.
  }
}

/** Return every stored event in insertion order (oldest first). */
export function readAllEvents(): UsageEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as UsageEvent[];
  } catch {
    return [];
  }
}

/** Wipe the usage log. */
export function clearUsage(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export type UsageRange = "24h" | "7d" | "30d" | "90d";

const RANGE_MS: Record<UsageRange, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

export function filterByRange(
  events: UsageEvent[],
  range: UsageRange
): UsageEvent[] {
  const cutoff = Date.now() - RANGE_MS[range];
  return events.filter((e) => e.ts >= cutoff);
}

export type UsageTotals = {
  agentRuns: number;
  sessions: number;
  totalTokens: number;
  totalCostUSD: number;
};

const SESSION_GAP_MS = 30 * 60 * 1000;

/** Roll up an event list into the four headline numbers shown on /usage. */
export function aggregate(events: UsageEvent[]): UsageTotals {
  if (events.length === 0) {
    return { agentRuns: 0, sessions: 0, totalTokens: 0, totalCostUSD: 0 };
  }
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  let sessions = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].ts - sorted[i - 1].ts > SESSION_GAP_MS) sessions++;
  }
  return {
    agentRuns: events.length,
    sessions,
    totalTokens: events.reduce((a, e) => a + e.totalTokens, 0),
    totalCostUSD: events.reduce((a, e) => a + e.totalCostUSD, 0),
  };
}

/** Group events into per-day buckets keyed by ISO date (UTC). */
export function bucketByDay(
  events: UsageEvent[]
): Array<{ date: string; tokens: number; costUSD: number }> {
  const buckets = new Map<string, { tokens: number; costUSD: number }>();
  for (const e of events) {
    const day = new Date(e.ts).toISOString().slice(0, 10);
    const bucket = buckets.get(day) ?? { tokens: 0, costUSD: 0 };
    bucket.tokens += e.totalTokens;
    bucket.costUSD += e.totalCostUSD;
    buckets.set(day, bucket);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
}

/** Leaderboard: top models by token usage. */
export function leaderboardByModel(
  events: UsageEvent[]
): Array<{ model: string; tokens: number; costUSD: number; runs: number }> {
  const acc = new Map<
    string,
    { tokens: number; costUSD: number; runs: number }
  >();
  for (const e of events) {
    const row = acc.get(e.model) ?? { tokens: 0, costUSD: 0, runs: 0 };
    row.tokens += e.totalTokens;
    row.costUSD += e.totalCostUSD;
    row.runs += 1;
    acc.set(e.model, row);
  }
  return Array.from(acc.entries())
    .map(([model, v]) => ({ model, ...v }))
    .sort((a, b) => b.tokens - a.tokens);
}

export const USAGE_STORAGE_KEY = STORAGE_KEY;
