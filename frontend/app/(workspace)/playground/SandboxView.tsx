"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSandboxBridge, type AttestReport, type DirEntry, type SandboxBridge } from "./SandboxBridge";
import { FileEditor } from "./Editor";
import { ChatPanel } from "./ChatPanel";

// xterm's UMD bundle references the browser-only `self` global at module
// top-level, which throws during Next's SSR/RSC evaluation of client
// components. Load it only in the browser, after hydration.
const Terminal = dynamic(() => import("./Terminal").then((m) => m.Terminal), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-neutral-500">Loading terminal…</div>
  ),
});

interface Props {
  sandboxId: string;
  repoUrl: string;
  wssUrl?: string;
  jwt?: string;
  onDestroy: () => void;
}

const COMMON_COMMANDS = [
  { label: "ls -la", cmd: "ls -la" },
  { label: "npm install", cmd: "npm install" },
  { label: "npm run build", cmd: "npm run build" },
  { label: "npm test", cmd: "npm test" },
  { label: "python main.py", cmd: "python3 main.py" },
  { label: "cargo build", cmd: "cargo build" },
  { label: "go run .", cmd: "go run ." },
];

type Tab = "editor" | "chat";

export function SandboxView({ sandboxId, repoUrl, wssUrl, jwt, onDestroy }: Props) {
  const { bridge, connected, error: bridgeError } = useSandboxBridge(wssUrl, jwt);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [ptyId, setPtyId] = useState<string | null>(null);
  const [customCmd, setCustomCmd] = useState("");
  const [tab, setTab] = useState<Tab>("editor");
  const [attestation, setAttestation] = useState<AttestReport | null>(null);

  useEffect(() => {
    if (!bridge) return;
    setPtyId(null);
    bridge.pty.open({}).then(setPtyId).catch(() => undefined);
    bridge.attest.report().then(setAttestation).catch(() => undefined);
  }, [bridge]);

  function runCommand(cmd: string): void {
    if (!bridge || !ptyId) return;
    bridge.pty.input(ptyId, `${cmd}\n`);
  }

  function runCustom(e: React.FormEvent): void {
    e.preventDefault();
    const trimmed = customCmd.trim();
    if (!trimmed) return;
    runCommand(trimmed);
    setCustomCmd("");
  }

  return (
    <section className="mt-10 border border-neutral-900">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-900 bg-neutral-950 px-5 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">
            Sandbox ready
          </h2>
          <p className="mt-0.5 truncate font-mono text-[0.65rem] text-neutral-500">
            {sandboxId} · {repoUrl}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AttestationBadge connected={connected} attestation={attestation} />
          <button
            type="button"
            onClick={onDestroy}
            className="border border-red-900/60 bg-red-950/30 px-3 py-1 text-[0.65rem] uppercase tracking-widest text-red-300 transition hover:bg-red-900/40"
          >
            Destroy
          </button>
        </div>
      </div>

      {bridgeError && (
        <div className="border-b border-red-900/40 bg-red-950/20 px-5 py-3 text-xs text-red-300">
          Failed to connect to the sandbox agent: {bridgeError}
        </div>
      )}

      {!bridge ? (
        <div className="flex h-64 items-center justify-center text-sm text-neutral-500">
          Connecting to sandbox agent…
        </div>
      ) : (
        <>
          {/* Three-pane layout */}
          <div className="grid grid-cols-1 md:grid-cols-12">
            {/* File tree */}
            <aside className="border-b border-neutral-900 bg-black p-3 md:col-span-3 md:border-b-0 md:border-r">
              <p className="mb-2 px-2 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-neutral-500">
                Files
              </p>
              <FileTree
                bridge={bridge}
                activePath={activePath}
                onOpen={(p) => {
                  setActivePath(p);
                  setTab("editor");
                }}
              />
            </aside>

            {/* Editor / Chat */}
            <div
              className="flex flex-col border-b border-neutral-900 bg-black md:col-span-6 md:border-b-0 md:border-r"
              style={{ height: 520 }}
            >
              <div className="flex shrink-0 border-b border-neutral-900 bg-neutral-950">
                <TabButton active={tab === "editor"} onClick={() => setTab("editor")}>
                  Editor
                </TabButton>
                <TabButton active={tab === "chat"} onClick={() => setTab("chat")}>
                  Chat
                </TabButton>
              </div>
              <div className="min-h-0 flex-1">
                {tab === "editor" ? (
                  activePath ? (
                    <FileEditor bridge={bridge} path={activePath} />
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-500">
                      Click a file on the left to open it.
                    </div>
                  )
                ) : (
                  <ChatPanel bridge={bridge} />
                )}
              </div>
            </div>

            {/* Run buttons */}
            <div className="bg-black md:col-span-3">
              <div className="border-b border-neutral-900 bg-neutral-950 px-4 py-2">
                <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-neutral-500">
                  Run
                </p>
              </div>
              <div className="space-y-2 p-3">
                {COMMON_COMMANDS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => runCommand(c.cmd)}
                    disabled={!ptyId}
                    className="block w-full border border-neutral-800 bg-black px-3 py-1.5 text-left font-mono text-[0.7rem] text-neutral-300 transition hover:border-neutral-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {c.label}
                  </button>
                ))}
                <form onSubmit={runCustom} className="flex gap-1.5 pt-2">
                  <input
                    value={customCmd}
                    onChange={(e) => setCustomCmd(e.target.value)}
                    placeholder="cmd args…"
                    className="flex-1 border border-neutral-800 bg-black px-2 py-1.5 font-mono text-[0.7rem] text-neutral-200 placeholder:text-neutral-700 focus:border-neutral-600 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!ptyId || !customCmd.trim()}
                    className="border border-white bg-white px-2.5 py-1.5 text-[0.65rem] font-medium uppercase tracking-widest text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-500"
                  >
                    Run
                  </button>
                </form>
                <p className="pt-1 text-[0.6rem] leading-relaxed text-neutral-600">
                  Runs in the terminal below — a live shell, not a one-shot exec.
                </p>
              </div>
            </div>
          </div>

          {/* Terminal */}
          <div className="border-t border-neutral-900 bg-black">
            <div className="border-b border-neutral-900 bg-neutral-950 px-5 py-2">
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-neutral-500">
                Terminal
              </p>
            </div>
            <div style={{ height: 280 }}>
              {ptyId ? (
                <Terminal bridge={bridge} ptyId={ptyId} />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                  Opening terminal…
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function AttestationBadge({
  connected,
  attestation,
}: {
  connected: boolean;
  attestation: AttestReport | null;
}) {
  if (!connected) {
    return (
      <span className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-widest text-neutral-500">
        <span className="h-1.5 w-1.5 rounded-full bg-neutral-700" />
        connecting
      </span>
    );
  }
  if (!attestation) {
    return (
      <span className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-widest text-neutral-500">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-600" />
        checking attestation
      </span>
    );
  }
  // Never render "verified" for a mock sandbox, and never render a scary
  // "failed" for what's honestly just local dev — a third, explicit state.
  if (attestation.mocked) {
    return (
      <span
        className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-widest text-amber-400"
        title="Running on the Confide backend, not inside a real Intel TDX CVM — see md/plan.md §12"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        mock sandbox — no TEE attestation
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-widest text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      TDX attested
    </span>
  );
}

function TabButton({
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
      className={`px-4 py-2 text-[0.65rem] font-medium uppercase tracking-widest transition ${
        active ? "border-b border-white text-white" : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}

function FileTree({
  bridge,
  activePath,
  onOpen,
}: {
  bridge: SandboxBridge;
  activePath: string | null;
  onOpen: (path: string) => void;
}) {
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEntries(null);
    setError(null);
    bridge.fs
      .list("")
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load file tree"));
  }, [bridge]);

  if (error) return <p className="px-2 text-xs text-red-400">{error}</p>;
  if (!entries) return <p className="px-2 text-xs text-neutral-500">Loading…</p>;
  return (
    <div className="max-h-96 overflow-y-auto pr-1 md:max-h-[480px]">
      {entries.map((e) => (
        <TreeRow
          key={e.name}
          bridge={bridge}
          name={e.name}
          path={e.name}
          isDir={e.isDir}
          depth={0}
          activePath={activePath}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

function TreeRow({
  bridge,
  name,
  path,
  isDir,
  depth,
  activePath,
  onOpen,
}: {
  bridge: SandboxBridge;
  name: string;
  path: string;
  isDir: boolean;
  depth: number;
  activePath: string | null;
  onOpen: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<DirEntry[] | null>(null);
  const indent = { paddingLeft: `${8 + depth * 12}px` };

  async function toggle(): Promise<void> {
    if (!open && children === null) {
      try {
        setChildren(await bridge.fs.list(path));
      } catch {
        setChildren([]);
      }
    }
    setOpen((o) => !o);
  }

  if (!isDir) {
    const isActive = activePath === path;
    return (
      <button
        type="button"
        onClick={() => onOpen(path)}
        style={indent}
        className={`block w-full truncate py-0.5 text-left font-mono text-[0.72rem] transition ${
          isActive ? "bg-neutral-900 text-white" : "text-neutral-400 hover:bg-neutral-950 hover:text-white"
        }`}
        title={path}
      >
        {name}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void toggle()}
        style={indent}
        className="block w-full truncate py-0.5 text-left font-mono text-[0.72rem] text-neutral-500 transition hover:text-white"
      >
        {open ? "▾ " : "▸ "}
        {name}
      </button>
      {open &&
        children?.map((c) => (
          <TreeRow
            key={c.name}
            bridge={bridge}
            name={c.name}
            path={`${path}/${c.name}`}
            isDir={c.isDir}
            depth={depth + 1}
            activePath={activePath}
            onOpen={onOpen}
          />
        ))}
    </>
  );
}
