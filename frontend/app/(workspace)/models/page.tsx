"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/app/components/workspace/TopBar";
import {
  NEAR_CATEGORIES,
  NEAR_CREATORS,
  NEAR_MODELS,
  type NearModel,
} from "@/lib/near-models";
import { logoForCreator, NEAR_LOGO_URL } from "@/lib/provider-logos";

type CategoryFilter = "All" | (typeof NEAR_CATEGORIES)[number];
type CreatorFilter = "All" | (typeof NEAR_CREATORS)[number];

export default function ModelsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [creator, setCreator] = useState<CreatorFilter>("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return NEAR_MODELS.filter((m) => {
      if (category !== "All" && m.category !== category) return false;
      if (creator !== "All" && m.creator !== creator) return false;
      if (!q) return true;
      return (
        m.modelName.toLowerCase().includes(q) ||
        m.modelId.toLowerCase().includes(q) ||
        m.creator.toLowerCase().includes(q)
      );
    });
  }, [query, category, creator]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Browse models</h1>
            <p className="mt-1 text-sm text-neutral-400">
              A catalog of NEAR AI Cloud models available for confidential inference.
              All models run inside a Trusted Execution Environment.
            </p>
          </div>

          {/* Search + filters */}
          <div className="mt-8 flex flex-col gap-4">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <circle cx="11" cy="11" r="7" strokeLinecap="round" strokeLinejoin="round" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full border border-neutral-800 bg-black px-9 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-neutral-500">
                  Category
                </p>
                <div className="flex flex-wrap gap-1">
                  <Chip
                    active={category === "All"}
                    onClick={() => setCategory("All")}
                  >
                    All
                  </Chip>
                  {NEAR_CATEGORIES.map((c) => (
                    <Chip
                      key={c}
                      active={category === c}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-neutral-500">
                  Creator
                </p>
                <div className="flex flex-wrap gap-1">
                  <Chip active={creator === "All"} onClick={() => setCreator("All")}>
                    All
                  </Chip>
                  {NEAR_CREATORS.map((c) => (
                    <Chip
                      key={c}
                      active={creator === c}
                      onClick={() => setCreator(c)}
                    >
                      {c}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Result count */}
          <p className="mt-6 text-xs text-neutral-500">
            {filtered.length} of {NEAR_MODELS.length} models
          </p>

          {/* Table */}
          <div className="mt-3 mb-10 border border-neutral-900">
            <div className="hidden grid-cols-12 gap-2 border-b border-neutral-900 bg-neutral-950 px-4 py-3 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-neutral-500 sm:grid">
              <span className="col-span-5">Model</span>
              <span className="col-span-2">Context</span>
              <span className="col-span-2 text-right">Input / M</span>
              <span className="col-span-2 text-right">Output / M</span>
              <span className="col-span-1 text-right">Provider</span>
            </div>
            <div className="divide-y divide-neutral-900">
              {filtered.length === 0 ? (
                <div className="flex h-32 items-center justify-center bg-black text-sm text-neutral-500">
                  No models match your filters.
                </div>
              ) : (
                filtered.map((m) => <ModelRow key={m.modelId} m={m} />)
              )}
            </div>
          </div>

          <p className="mb-10 text-xs text-neutral-600">
            Want to test a model end-to-end?{" "}
            <Link href="/chat" className="text-neutral-300 underline-offset-2 hover:underline">
              Open the workspace
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-2.5 py-1 text-xs transition ${
        active
          ? "border-white bg-white text-black"
          : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function ModelRow({ m }: { m: NearModel }) {
  return (
    <div className="grid grid-cols-1 gap-1 bg-black px-4 py-3 transition hover:bg-neutral-950 sm:grid-cols-12 sm:gap-2">
      <div className="flex items-center gap-3 sm:col-span-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoForCreator(m.creator)}
          alt=""
          aria-hidden="true"
          className="h-9 w-9 shrink-0"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{m.modelName}</p>
          <p className="mt-0.5 truncate font-mono text-[0.7rem] text-neutral-500">
            {m.modelId}
          </p>
          <p className="mt-0.5 text-[0.65rem] uppercase tracking-widest text-neutral-600">
            {m.creator} · {m.category}
          </p>
        </div>
      </div>
      <div className="text-xs text-neutral-400 sm:col-span-2 sm:self-center">
        {m.contextLabel}
      </div>
      <div className="text-xs text-neutral-300 sm:col-span-2 sm:self-center sm:text-right">
        {m.inputPerM} <span className="text-neutral-600">/M</span>
      </div>
      <div className="text-xs text-neutral-300 sm:col-span-2 sm:self-center sm:text-right">
        {m.outputPerM} <span className="text-neutral-600">/M</span>
      </div>
      <div className="flex items-center sm:col-span-1 sm:justify-end sm:self-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={NEAR_LOGO_URL}
          alt="NEAR"
          className="h-5 w-5 rounded-full"
          title="NEAR AI Cloud"
        />
      </div>
    </div>
  );
}
