"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/app/components/workspace/TopBar";
import { api, type GithubRepo, type MeResponse, type SandboxSession } from "@/lib/api";

export default function PlaygroundPage() {
  return (
    <Suspense fallback={null}>
      <PlaygroundInner />
    </Suspense>
  );
}

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

function PlaygroundInner() {
  const searchParams = useSearchParams();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [me, setMe] = useState<MeResponse | null>(null);
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [reposError, setReposError] = useState<string | null>(null);

  const [session, setSession] = useState<SandboxSession | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount, ask the backend whether we already have a GitHub session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.me();
        if (!cancelled) setMe(result);
      } catch {
        if (!cancelled) setMe({ authenticated: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When `?auth=ok` lands from the OAuth callback, refresh /me and clean the URL.
  useEffect(() => {
    const auth = searchParams.get("auth");
    if (auth === "ok") {
      api.me().then(setMe).catch(() => undefined);
      // Strip the query param so a reload doesn't re-trigger.
      window.history.replaceState({}, "", "/playground");
    } else if (auth === "denied") {
      setError("GitHub authorization was cancelled.");
      window.history.replaceState({}, "", "/playground");
    }
  }, [searchParams]);

  // Once authenticated, fetch repos lazily.
  useEffect(() => {
    if (!me?.authenticated || repos !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await api.repos({ perPage: 50, sort: "updated" });
        if (!cancelled) setRepos(result.repos);
      } catch (err) {
        if (!cancelled) {
          const e = err as { error?: string };
          setReposError(e.error ?? "Failed to load repositories");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me, repos]);

  const startConnect = useCallback(() => {
    const returnTo = typeof window !== "undefined" ? `${window.location.origin}/playground` : "";
    if (!returnTo) return;
    window.location.href = api.startGithubLogin(returnTo);
  }, []);

  const disconnect = useCallback(async () => {
    await api.logout();
    setMe({ authenticated: false });
    setRepos(null);
    setReposError(null);
  }, []);

  const importRepo = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      setError(null);
      const trimmed = url.trim();
      if (!isValidGithubUrl(trimmed)) {
        setError("Please paste a valid GitHub URL (e.g. https://github.com/owner/repo).");
        return;
      }
      setBusy(true);
      try {
        const created = await api.spawnSandbox(trimmed);
        setSession(created);
      } catch (err) {
        const e = err as { error?: string; detail?: string };
        setError(e.error || "Failed to spawn sandbox. Is the backend running on :4000?");
      } finally {
        setBusy(false);
      }
    },
    [url]
  );

  // Poll sandbox status until it leaves transient states.
  useEffect(() => {
    if (!session) return;
    const transient: SandboxSession["status"][] = [
      "queued",
      "spawning",
      "cloning",
    ];
    if (!transient.includes(session.status)) return;

    pollRef.current = setInterval(async () => {
      try {
        const next = await api.getSandbox(session.id);
        setSession(next);
        if (!transient.includes(next.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 800);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [session]);

  const pickRepo = useCallback((repo: GithubRepo) => {
    setUrl(repo.htmlUrl);
    setError(null);
  }, []);

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
                  disabled={busy || !url.trim()}
                  className="border border-white bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-800 disabled:text-neutral-500"
                >
                  {busy ? "Importing…" : "Import"}
                </button>
              </form>
              {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

              <div className="mt-8 border-t border-neutral-900 pt-6">
                {me === null ? (
                  <p className="text-xs text-neutral-500">Checking session…</p>
                ) : me.authenticated && me.user ? (
                  <ConnectedGithub
                    user={me.user}
                    repos={repos}
                    reposError={reposError}
                    onPick={pickRepo}
                    onDisconnect={() => void disconnect()}
                  />
                ) : (
                  <DisconnectedGithub onConnect={startConnect} />
                )}
              </div>
            </div>
          </section>

          {/* Sandbox status */}
          {session && (
            <section className="mt-10 border border-emerald-900/40 bg-emerald-950/10 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">
                    Sandbox status
                  </h2>
                  <p className="mt-1 font-mono text-[0.65rem] text-neutral-500">
                    {session.id} · {session.repoUrl}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void api.destroySandbox(session.id);
                    setSession(null);
                  }}
                  className="border border-neutral-800 px-3 py-1 text-[0.65rem] uppercase tracking-widest text-neutral-400 transition hover:border-neutral-600 hover:text-white"
                >
                  Destroy
                </button>
              </div>
              <div className="mt-4 space-y-2 text-xs">
                <Step label="Repository URL accepted" done />
                <Step
                  label="Spawning confidential VM (Intel TDX)…"
                  done={["cloning", "ready"].includes(session.status)}
                  active={session.status === "spawning"}
                />
                <Step
                  label="Cloning repository inside the enclave"
                  done={session.status === "ready"}
                  active={session.status === "cloning"}
                />
                <Step
                  label="Attestation handshake"
                  done={session.status === "ready"}
                  active={session.status === "ready" && !session.attestation?.verified}
                  pending={session.status !== "ready"}
                />
              </div>
              {session.error && (
                <p className="mt-3 text-xs text-red-400">{session.error}</p>
              )}
              <p className="mt-4 text-[0.65rem] text-neutral-500">
                The real CVM spawn is documented in md/08-playground-design.md.
                This sandbox is a mock today — the spawn API just simulates the
                state transitions so the UI is testable.
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

function DisconnectedGithub({ onConnect }: { onConnect: () => void }) {
  return (
    <>
      <h3 className="text-sm font-medium text-white">Connect to GitHub</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Link your GitHub account to browse and import your repositories.
      </p>
      <button
        type="button"
        onClick={onConnect}
        className="mt-4 inline-flex items-center gap-2 border border-neutral-800 bg-black px-4 py-2 text-xs font-medium text-white transition hover:border-neutral-600 hover:bg-neutral-950"
      >
        <GithubMark />
        Connect GitHub
      </button>
    </>
  );
}

function ConnectedGithub({
  user,
  repos,
  reposError,
  onPick,
  onDisconnect,
}: {
  user: NonNullable<MeResponse["user"]>;
  repos: GithubRepo[] | null;
  reposError: string | null;
  onPick: (r: GithubRepo) => void;
  onDisconnect: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={user.avatarUrl}
            alt={user.login}
            className="h-8 w-8 rounded-full border border-neutral-800"
          />
          <div>
            <p className="text-sm font-medium text-white">
              {user.name ?? user.login}
            </p>
            <p className="text-[0.65rem] uppercase tracking-widest text-neutral-500">
              @{user.login} · GitHub connected
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDisconnect}
          className="border border-neutral-800 px-3 py-1 text-[0.65rem] uppercase tracking-widest text-neutral-400 transition hover:border-neutral-600 hover:text-white"
        >
          Disconnect
        </button>
      </div>

      <div className="mt-5">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-neutral-500">
          Your repositories
        </p>
        {repos === null && !reposError && (
          <p className="mt-3 text-xs text-neutral-500">Loading repositories…</p>
        )}
        {reposError && (
          <p className="mt-3 text-xs text-red-400">{reposError}</p>
        )}
        {repos && repos.length === 0 && (
          <p className="mt-3 text-xs text-neutral-500">No repositories found.</p>
        )}
        {repos && repos.length > 0 && (
          <ul className="mt-3 max-h-64 divide-y divide-neutral-900 overflow-y-auto border border-neutral-900">
            {repos.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onPick(r)}
                  className="flex w-full items-center justify-between gap-3 bg-black px-4 py-2.5 text-left transition hover:bg-neutral-950"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{r.fullName}</p>
                    {r.description && (
                      <p className="truncate text-[0.65rem] text-neutral-500">
                        {r.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-[0.65rem] uppercase tracking-widest text-neutral-500">
                    {r.private && <span className="text-amber-400">private</span>}
                    {r.language && <span>{r.language}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function GithubMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.09c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.17 1.18.92-.26 1.91-.39 2.89-.39s1.97.13 2.89.39c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
    </svg>
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
