/**
 * JSONL-backed usage event store.
 *
 * On boot we load the entire log into memory so reads (aggregate, leaderboard)
 * are O(1) trips to the array. Writes append a single line to disk and push
 * to the in-memory array — same shape on both sides.
 *
 * No Postgres for the MVP. The schema is identical to what we'll persist into
 * a real DB later, so migration is straight INSERTs.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "@/config.js";
import { computeCostUSD } from "@/lib/pricing.js";
import type {
  Receipt,
  UsageEvent,
  UsageRange,
  UsageTotals,
} from "@/types/index.js";

const FILE_NAME = "usage.jsonl";
const MAX_EVENTS_IN_MEMORY = 100_000;

let events: UsageEvent[] = [];
let initialized = false;

function filePath(): string {
  return path.join(config.dataDir, FILE_NAME);
}

function ensureDir(): void {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

function loadFromDisk(): UsageEvent[] {
  const fp = filePath();
  if (!fs.existsSync(fp)) return [];
  const lines = fs.readFileSync(fp, "utf8").split("\n");
  const out: UsageEvent[] = [];
  for (const line of lines) {
    if (!line) continue;
    try {
      out.push(JSON.parse(line) as UsageEvent);
    } catch {
      // Corrupted line — skip. We don't truncate the file so the user can recover by hand.
    }
  }
  // Keep memory bounded; we still keep the full history on disk.
  return out.slice(-MAX_EVENTS_IN_MEMORY);
}

export function initUsageStore(): void {
  if (initialized) return;
  ensureDir();
  events = loadFromDisk();
  initialized = true;
}

function genId(): string {
  return crypto.randomUUID();
}

/**
 * Persist a usage event derived from a chat receipt.
 * Returns the event we wrote, including its server-assigned id.
 */
export function appendFromReceipt(receipt: Receipt): UsageEvent | null {
  initUsageStore();
  // Stub responses (no NEAR key) are not chargeable — skip.
  if (receipt.mocked) return null;

  const promptTokens = receipt.usage?.promptTokens ?? 0;
  const completionTokens = receipt.usage?.completionTokens ?? 0;
  const totalTokens =
    receipt.usage?.totalTokens ?? promptTokens + completionTokens;

  const { inputCostUSD, outputCostUSD, totalCostUSD } = computeCostUSD(
    receipt.model,
    promptTokens,
    completionTokens
  );

  const event: UsageEvent = {
    id: receipt.requestId ?? genId(),
    ts: Date.now(),
    model: receipt.model,
    promptTokens,
    completionTokens,
    totalTokens,
    inputCostUSD,
    outputCostUSD,
    totalCostUSD,
    latencyMs: receipt.latencyMs,
    attested: receipt.attestation.attested,
  };
  if (receipt.requestId) event.requestId = receipt.requestId;

  events.push(event);
  if (events.length > MAX_EVENTS_IN_MEMORY) {
    events = events.slice(-MAX_EVENTS_IN_MEMORY);
  }

  // Append-only on disk so the file doubles as an audit log.
  fs.appendFileSync(filePath(), JSON.stringify(event) + "\n", "utf8");
  return event;
}

const RANGE_MS: Record<UsageRange, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

export function readEvents(opts?: {
  range?: UsageRange;
  model?: string;
  limit?: number;
}): UsageEvent[] {
  initUsageStore();
  const cutoff = opts?.range ? Date.now() - RANGE_MS[opts.range] : 0;
  const filtered = events.filter((e) => {
    if (cutoff > 0 && e.ts < cutoff) return false;
    if (opts?.model && e.model !== opts.model) return false;
    return true;
  });
  if (opts?.limit && filtered.length > opts.limit) {
    return filtered.slice(-opts.limit);
  }
  return filtered;
}

const SESSION_GAP_MS = 30 * 60 * 1000;

export function aggregate(events: UsageEvent[]): UsageTotals {
  if (events.length === 0) {
    return { agentRuns: 0, sessions: 0, totalTokens: 0, totalCostUSD: 0 };
  }
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  let sessions = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.ts - sorted[i - 1]!.ts > SESSION_GAP_MS) sessions++;
  }
  return {
    agentRuns: events.length,
    sessions,
    totalTokens: events.reduce((a, e) => a + e.totalTokens, 0),
    totalCostUSD: events.reduce((a, e) => a + e.totalCostUSD, 0),
  };
}

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

/** Test-only — wipes both memory and the on-disk log. Not exposed via HTTP. */
export function _resetForTests(): void {
  events = [];
  initialized = false;
  const fp = filePath();
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}
