"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/app/components/workspace/TopBar";

const templates = [
  { label: "Next.js", description: "Full-stack React framework", color: "bg-white text-black" },
  { label: "Hono", description: "Edge-ready TypeScript backend", color: "bg-orange-500 text-black" },
  { label: "Python", description: "Flask / FastAPI starter", color: "bg-blue-500 text-white" },
  { label: "Svelte", description: "SvelteKit + Vite", color: "bg-orange-600 text-white" },
];

function isValidGithubUrl(url: string) {
  try {
    const u = new URL(url.trim());
    if (u.hostname !== "github.com" && u.hostname !== "www.github.com") return false;
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length >= 2;
  } catch {
    return false;
  }
}

export default function PlaygroundPage() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<
    "idle" | "queued" | "spinning" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  function importRepo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidGithubUrl(url)) {
      setError("Please paste a valid GitHub repository URL (e.g. https://github.com/owner/repo).");
      return;
    }
    setStatus("queued");
    // Simulate spawn — real impl will hit /api/sandbox (see plan.md §11).
    setTimeout(() => setStatus("spinning"), 600);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-10">
          {/* Header */}
          <div>
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.25em] text-neutral-500">
              Playground
            </p>
            <h1 className="mt-3 text-balance text-3xl font-semibold leading-[1.05] tracking-tight sm:text-5xl sm:leading-[1.0]">
              Paste a repo. <span className="font-serif font-normal italic">Run</span> it inside a TEE.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-neutral-400 sm:text-base">
              We&apos;ll spin up a confidential VM, clone the repository, and let you
              edit, run, and chat with the code — every AI completion routed through
              NEAR&apos;s attested inference.
            </p>
          </div>

          {/* Start from code */}
          <section className="mt-10 border border-neutral-900">
            <div className="border-b border-neutral-900 bg-neutral-950 px-5 py-3">
              <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
                Start from code
              </h2>
            </div>
            <div className="bg-black p-6">
              <p className="text-sm text-neutral-400">
                Connect GitHub and import an existing repository.
              </p>

              <form onSubmit={importRepo} className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste a GitHub repository URL…"
                  className="flex-1 border border-neutral-800 bg-black px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
                />
                <button
                  type="submit"
                  className="border border-white bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200"
                >
                  Import
                </button>
              </form>
              {error && (
                <p className="mt-2 text-xs text-red-400">{error}</p>
              )}

              <div className="mt-8 border-t border-neutral-900 pt-6">
                <h3 className="text-sm font-medium text-white">Connect to GitHub</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Link your GitHub account to browse and import your repositories.
                </p>
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-2 border border-neutral-800 bg-black px-4 py-2 text-xs font-medium text-white transition hover:border-neutral-600 hover:bg-neutral-950"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.09c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.17 1.18.92-.26 1.91-.39 2.89-.39s1.97.13 2.89.39c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
                  </svg>
                  Connect GitHub
                </button>
              </div>
            </div>
          </section>

          {/* Templates */}
          <section className="mt-10 border border-neutral-900">
            <div className="border-b border-neutral-900 bg-neutral-950 px-5 py-3">
              <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
                Start from template
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-px bg-neutral-900 sm:grid-cols-2 lg:grid-cols-4">
              {templates.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  className="group bg-black p-6 text-left transition hover:bg-neutral-950"
                >
                  <div
                    className={`mb-4 flex h-10 w-10 items-center justify-center text-[0.7rem] font-bold uppercase tracking-widest ${t.color}`}
                  >
                    {t.label.slice(0, 2)}
                  </div>
                  <p className="text-sm font-medium text-white">{t.label}</p>
                  <p className="mt-1 text-xs text-neutral-500">{t.description}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Live status */}
          {status !== "idle" && (
            <section className="mt-10 border border-emerald-900/40 bg-emerald-950/10 p-6">
              <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">
                Sandbox status
              </h2>
              <div className="mt-3 space-y-2 text-xs">
                <Step label="Repository URL accepted" done />
                <Step
                  label="Spawning confidential VM (Intel TDX)…"
                  done={status === "spinning"}
                  active={status === "queued"}
                />
                <Step
                  label="Cloning repository inside the enclave"
                  active={status === "spinning"}
                />
                <Step
                  label="Attestation handshake"
                  pending
                />
              </div>
              <p className="mt-4 text-[0.65rem] text-neutral-500">
                The live spawn API isn&apos;t wired yet (see plan.md §11).
                When it is, this panel will stream real progress.
              </p>
            </section>
          )}

          {/* Trust note */}
          <section className="mt-10 mb-12 border border-neutral-900 bg-neutral-950 p-6">
            <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
              How the sandbox protects you
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-neutral-300">
              <li>• The repository is cloned inside an Intel TDX confidential VM.</li>
              <li>• The browser verifies the VM&apos;s TDX quote before unlocking the editor.</li>
              <li>• Every AI completion is routed through NEAR&apos;s TEE with a signed receipt.</li>
              <li>• Closing the tab destroys the VM within 60 seconds. Nothing persists by default.</li>
            </ul>
            <p className="mt-4 text-xs text-neutral-500">
              <Link href="/chat" className="text-neutral-300 underline-offset-2 hover:underline">
                Want a regular chat instead?
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Step({
  label,
  done,
  active,
  pending,
}: {
  label: string;
  done?: boolean;
  active?: boolean;
  pending?: boolean;
}) {
  const dot = done ? "bg-emerald-400" : active ? "bg-emerald-400 animate-pulse" : "bg-neutral-700";
  const text = done
    ? "text-neutral-200"
    : active
    ? "text-white"
    : pending
    ? "text-neutral-500"
    : "text-neutral-400";
  return (
    <div className="flex items-center gap-2">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className={text}>{label}</span>
    </div>
  );
}
