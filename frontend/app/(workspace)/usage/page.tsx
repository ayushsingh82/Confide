"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/app/components/workspace/TopBar";
import {
  aggregate,
  bucketByDay,
  filterByRange,
  leaderboardByModel,
  readAllEvents,
  type UsageEvent,
  type UsageRange,
} from "@/lib/usage";

const ranges: UsageRange[] = ["24h", "7d", "30d", "90d"];

function StatBox({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-black p-6 sm:p-8">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{hint}</p>
    </div>
  );
}

function EmptyBox({
  title,
  body,
  height = "h-56",
}: {
  title: string;
  body: string;
  height?: string;
}) {
  return (
    <div
      className={`flex ${height} flex-col items-center justify-center bg-black px-6 text-center`}
    >
      <svg
        className="mb-3 h-8 w-8 text-neutral-700"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14l4-4 4 4 5-6" />
      </svg>
      <p className="text-sm font-medium text-neutral-300">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-neutral-500">{body}</p>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatUSD(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default function UsagePage() {
  const [range, setRange] = useState<UsageRange>("30d");
  const [events, setEvents] = useState<UsageEvent[]>([]);

  useEffect(() => {
    setEvents(readAllEvents());
  }, []);

  const filtered = filterByRange(events, range);
  const totals = aggregate(filtered);
  const byDay = bucketByDay(filtered);
  const leaderboard = leaderboardByModel(filtered);

  const rangeHintMap: Record<UsageRange, string> = {
    "24h": "Last 24 hours",
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
  };
  const rangeHint = rangeHintMap[range];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {/* Header */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
              <p className="mt-1 text-sm text-neutral-400">
                Monitor your resource consumption and usage metrics.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden border border-neutral-800 bg-neutral-950">
                {ranges.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`px-3 py-1.5 text-xs transition ${
                      r === range
                        ? "bg-white text-black"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    {r}
                  </button>
                ))}
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs text-neutral-500 hover:text-white"
                  disabled
                >
                  custom
                </button>
              </div>
              <select className="border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-300 focus:border-neutral-600 focus:outline-none">
                <option>All members</option>
              </select>
            </div>
          </div>

          {/* Stat squares */}
          <div className="grid grid-cols-1 gap-px border border-neutral-900 bg-neutral-900 sm:grid-cols-2 lg:grid-cols-4">
            <StatBox
              label="Agent Runs"
              value={totals.agentRuns.toLocaleString()}
              hint={rangeHint}
            />
            <StatBox
              label="Sessions"
              value={totals.sessions.toLocaleString()}
              hint={rangeHint}
            />
            <StatBox
              label="Total Tokens"
              value={formatTokens(totals.totalTokens)}
              hint="Across all projects"
            />
            <StatBox
              label="Total Cost"
              value={formatUSD(totals.totalCostUSD)}
              hint={rangeHint}
            />
          </div>

          {/* Token consumption */}
          <section className="mt-10">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Token Consumption by Day
                </h2>
                <p className="text-xs text-neutral-500">
                  Tokens used over the {rangeHint.toLowerCase()}
                </p>
              </div>
            </div>
            <div className="border border-neutral-900">
              {byDay.length === 0 ? (
                <EmptyBox
                  title="No usage data available"
                  body="Projects will appear here once they have token consumption data."
                  height="h-64"
                />
              ) : (
                <BarChart byDay={byDay} />
              )}
            </div>
          </section>

          {/* Two-up */}
          <div className="mt-10 grid grid-cols-1 gap-px border border-neutral-900 bg-neutral-900 lg:grid-cols-2">
            <div className="bg-black p-6">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
                Workspace Runtime
              </h2>
              <EmptyBox
                title="No workspace data available"
                body="Sandbox runtime data will appear here."
              />
            </div>
            <div className="bg-black p-6">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
                Sandbox Costs
              </h2>
              <EmptyBox
                title="No sandbox cost data available"
                body="Sandbox billing details will appear here once workspaces are used."
              />
            </div>
          </div>

          {/* Inference */}
          <section className="mt-10">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Inference Usage{" "}
                  <span className="text-xs uppercase tracking-widest text-neutral-500">
                    (NEAR)
                  </span>
                </h2>
                <p className="text-xs text-neutral-500">{rangeHint} · by day</p>
              </div>
            </div>
            <div className="border border-neutral-900">
              {byDay.length === 0 ? (
                <EmptyBox
                  title="No inference usage data"
                  body="Inference requests via NEAR AI Cloud will appear here once made."
                  height="h-64"
                />
              ) : (
                <BarChart byDay={byDay} />
              )}
            </div>
          </section>

          {/* Leaderboard */}
          <section className="mt-10 mb-12">
            <h2 className="mb-3 text-lg font-semibold tracking-tight">
              Usage Leaderboard
            </h2>
            <div className="border border-neutral-900">
              {leaderboard.length === 0 ? (
                <EmptyBox
                  title="No leaderboard data available"
                  body="Usage data will appear here once team members start using the platform."
                />
              ) : (
                <div className="divide-y divide-neutral-900">
                  {leaderboard.map((row) => (
                    <div
                      key={row.model}
                      className="grid grid-cols-12 gap-2 bg-black px-6 py-3 text-sm"
                    >
                      <span className="col-span-6 truncate font-mono text-xs text-neutral-300">
                        {row.model}
                      </span>
                      <span className="col-span-2 text-right text-neutral-400">
                        {row.runs} runs
                      </span>
                      <span className="col-span-2 text-right text-neutral-400">
                        {formatTokens(row.tokens)} tok
                      </span>
                      <span className="col-span-2 text-right text-emerald-300">
                        {formatUSD(row.costUSD)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function BarChart({
  byDay,
}: {
  byDay: Array<{ date: string; tokens: number; costUSD: number }>;
}) {
  const max = Math.max(...byDay.map((b) => b.tokens), 1);
  return (
    <div className="flex h-64 items-end gap-1 bg-black p-4">
      {byDay.map((b) => {
        const heightPct = (b.tokens / max) * 100;
        return (
          <div
            key={b.date}
            className="group flex flex-1 flex-col items-center gap-1"
            title={`${b.date} — ${b.tokens.toLocaleString()} tok · $${b.costUSD.toFixed(4)}`}
          >
            <div
              className="w-full bg-emerald-500/70 transition-colors group-hover:bg-emerald-400"
              style={{ height: `${Math.max(heightPct, 2)}%` }}
            />
            <span className="text-[0.55rem] text-neutral-600">
              {b.date.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
