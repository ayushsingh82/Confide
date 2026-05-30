"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type SandboxExecResult, type SandboxTreeNode } from "@/lib/api";

interface Props {
  sandboxId: string;
  repoUrl: string;
  onDestroy: () => void;
}

const COMMON_COMMANDS = [
  { label: "ls -la", cmd: "ls", args: ["-la"] },
  { label: "npm install", cmd: "npm", args: ["install"] },
  { label: "npm run build", cmd: "npm", args: ["run", "build"] },
  { label: "npm test", cmd: "npm", args: ["test"] },
  { label: "python main.py", cmd: "python3", args: ["main.py"] },
  { label: "cargo build", cmd: "cargo", args: ["build"] },
  { label: "go run .", cmd: "go", args: ["run", "."] },
];

export function SandboxView({ sandboxId, repoUrl, onDestroy }: Props) {
  const [tree, setTree] = useState<SandboxTreeNode | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [activeContents, setActiveContents] = useState<string>("");
  const [activeTruncated, setActiveTruncated] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const [execHistory, setExecHistory] = useState<SandboxExecResult[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [customCmd, setCustomCmd] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  const reloadTree = useCallback(async () => {
    setTreeError(null);
    try {
      const result = await api.sandboxTree(sandboxId);
      setTree(result.tree);
    } catch (err) {
      const e = err as { error?: string };
      setTreeError(e.error ?? "Failed to load file tree");
    }
  }, [sandboxId]);

  useEffect(() => {
    void reloadTree();
  }, [reloadTree]);

  const openFile = useCallback(
    async (path: string) => {
      setFileError(null);
      setActivePath(path);
      setDirty(false);
      try {
        const result = await api.readSandboxFile(sandboxId, path);
        setActiveContents(result.contents);
        setActiveTruncated(result.truncated);
      } catch (err) {
        const e = err as { error?: string };
        setFileError(e.error ?? "Failed to read file");
        setActiveContents("");
      }
    },
    [sandboxId]
  );

  const saveFile = useCallback(async () => {
    if (!activePath || !dirty) return;
    setSaving(true);
    try {
      await api.writeSandboxFile(sandboxId, activePath, activeContents);
      setDirty(false);
    } catch (err) {
      const e = err as { error?: string };
      setFileError(e.error ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }, [sandboxId, activePath, activeContents, dirty]);

  // Cmd/Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void saveFile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveFile]);

  const exec = useCallback(
    async (cmd: string, args: string[]) => {
      const label = [cmd, ...args].join(" ");
      setRunning(label);
      try {
        const result = await api.exec(sandboxId, cmd, args);
        setExecHistory((h) => [...h, result]);
        // After exec, re-read the active file (it might have been changed by
        // the command, e.g. `npm install` writing package-lock.json).
        if (activePath) {
          try {
            const fresh = await api.readSandboxFile(sandboxId, activePath);
            if (!dirty) setActiveContents(fresh.contents);
          } catch {
            // not fatal
          }
        }
        // Reload tree in case files appeared (node_modules is skipped server-side, but lockfiles still show).
        void reloadTree();
        setTimeout(() => {
          outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
        }, 0);
      } catch (err) {
        const e = err as { error?: string };
        const failed: SandboxExecResult = {
          cmd,
          args,
          exitCode: null,
          signal: null,
          durationMs: 0,
          stdout: "",
          stderr: e.error ?? "Failed to invoke exec",
          stdoutTruncated: false,
          stderrTruncated: false,
          timedOut: false,
        };
        setExecHistory((h) => [...h, failed]);
      } finally {
        setRunning(null);
      }
    },
    [sandboxId, activePath, dirty, reloadTree]
  );

  const runCustom = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = customCmd.trim();
      if (!trimmed) return;
      const parts = trimmed.split(/\s+/);
      const cmd = parts[0]!;
      const args = parts.slice(1);
      void exec(cmd, args);
    },
    [customCmd, exec]
  );

  // Flatten tree for breadcrumb display only — we still render the recursive tree below.
  const flatFileCount = useMemo(() => {
    if (!tree) return 0;
    let n = 0;
    const walk = (node: SandboxTreeNode): void => {
      if (node.type === "file") n++;
      else node.children?.forEach(walk);
    };
    walk(tree);
    return n;
  }, [tree]);

  return (
    <section className="mt-10 border border-neutral-900">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-900 bg-neutral-950 px-5 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">
            Sandbox ready
          </h2>
          <p className="mt-0.5 truncate font-mono text-[0.65rem] text-neutral-500">
            {sandboxId} · {repoUrl} · {flatFileCount} files
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void reloadTree()}
            className="border border-neutral-800 px-3 py-1 text-[0.65rem] uppercase tracking-widest text-neutral-400 transition hover:border-neutral-600 hover:text-white"
          >
            Refresh tree
          </button>
          <button
            type="button"
            onClick={onDestroy}
            className="border border-red-900/60 bg-red-950/30 px-3 py-1 text-[0.65rem] uppercase tracking-widest text-red-300 transition hover:bg-red-900/40"
          >
            Destroy
          </button>
        </div>
      </div>

      {/* Three-pane layout */}
      <div className="grid grid-cols-1 md:grid-cols-12">
        {/* File tree */}
        <aside className="border-b border-neutral-900 bg-black p-3 md:col-span-3 md:border-b-0 md:border-r">
          <p className="mb-2 px-2 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-neutral-500">
            Files
          </p>
          {treeError && <p className="px-2 text-xs text-red-400">{treeError}</p>}
          {!treeError && !tree && (
            <p className="px-2 text-xs text-neutral-500">Loading…</p>
          )}
          {tree && (
            <div className="max-h-96 overflow-y-auto pr-1 md:max-h-[480px]">
              {tree.children?.map((node) => (
                <TreeRow
                  key={node.path}
                  node={node}
                  depth={0}
                  activePath={activePath}
                  onOpen={openFile}
                />
              ))}
            </div>
          )}
        </aside>

        {/* Editor */}
        <div className="border-b border-neutral-900 bg-black md:col-span-6 md:border-b-0 md:border-r">
          {activePath ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-neutral-900 bg-neutral-950 px-4 py-2">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-neutral-300">
                    {activePath}
                    {dirty && <span className="ml-2 text-emerald-400">●</span>}
                    {activeTruncated && (
                      <span className="ml-2 text-amber-400">(truncated)</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void saveFile()}
                  disabled={!dirty || saving}
                  className="border border-neutral-800 px-3 py-1 text-[0.65rem] uppercase tracking-widest text-neutral-300 transition hover:border-neutral-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save (⌘S)"}
                </button>
              </div>
              {fileError && (
                <div className="border-b border-red-900/40 bg-red-950/20 px-4 py-2 text-xs text-red-300">
                  {fileError}
                </div>
              )}
              <textarea
                value={activeContents}
                onChange={(e) => {
                  setActiveContents(e.target.value);
                  setDirty(true);
                }}
                spellCheck={false}
                className="block h-96 w-full resize-none bg-black p-4 font-mono text-[0.75rem] leading-relaxed text-neutral-200 outline-none placeholder:text-neutral-700 md:h-[480px]"
              />
            </>
          ) : (
            <div className="flex h-96 items-center justify-center px-6 text-center text-sm text-neutral-500 md:h-[480px]">
              Click a file on the left to open it.
            </div>
          )}
        </div>

        {/* Terminal / exec */}
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
                onClick={() => void exec(c.cmd, c.args)}
                disabled={running !== null}
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
                disabled={running !== null || !customCmd.trim()}
                className="border border-white bg-white px-2.5 py-1.5 text-[0.65rem] font-medium uppercase tracking-widest text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-500"
              >
                Run
              </button>
            </form>
            {running && (
              <p className="mt-2 flex items-center gap-1.5 text-[0.65rem] text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Running: <span className="font-mono">{running}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Output */}
      <div className="border-t border-neutral-900 bg-black">
        <div className="border-b border-neutral-900 bg-neutral-950 px-5 py-2">
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-neutral-500">
            Output
          </p>
        </div>
        <div
          ref={outputRef}
          className="max-h-96 overflow-y-auto bg-black p-4 font-mono text-[0.7rem] leading-relaxed text-neutral-300"
        >
          {execHistory.length === 0 ? (
            <p className="text-neutral-600">
              Run a command and the output lands here.
            </p>
          ) : (
            execHistory.map((r, i) => (
              <div key={i} className="mb-4">
                <p className="text-neutral-500">
                  $ {r.cmd} {r.args.join(" ")}{" "}
                  <span className="text-neutral-700">
                    · exit {r.exitCode ?? "?"} · {r.durationMs}ms
                    {r.timedOut ? " · timed out" : ""}
                  </span>
                </p>
                {r.stdout && (
                  <pre className="mt-1 whitespace-pre-wrap break-words text-neutral-200">
                    {r.stdout}
                    {r.stdoutTruncated && (
                      <span className="text-amber-400">
                        {"\n[stdout truncated — output capped at 512 KB]"}
                      </span>
                    )}
                  </pre>
                )}
                {r.stderr && (
                  <pre className="mt-1 whitespace-pre-wrap break-words text-red-300/80">
                    {r.stderr}
                    {r.stderrTruncated && (
                      <span className="text-amber-400">
                        {"\n[stderr truncated]"}
                      </span>
                    )}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function TreeRow({
  node,
  depth,
  activePath,
  onOpen,
}: {
  node: SandboxTreeNode;
  depth: number;
  activePath: string | null;
  onOpen: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const indent = { paddingLeft: `${8 + depth * 12}px` };

  if (node.type === "file") {
    const isActive = activePath === node.path;
    return (
      <button
        type="button"
        onClick={() => onOpen(node.path)}
        style={indent}
        className={`block w-full truncate py-0.5 text-left font-mono text-[0.72rem] transition ${
          isActive
            ? "bg-neutral-900 text-white"
            : "text-neutral-400 hover:bg-neutral-950 hover:text-white"
        }`}
        title={node.path}
      >
        {node.name}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={indent}
        className="block w-full truncate py-0.5 text-left font-mono text-[0.72rem] text-neutral-500 transition hover:text-white"
      >
        {open ? "▾ " : "▸ "}
        {node.name}
      </button>
      {open &&
        node.children?.map((child) => (
          <TreeRow
            key={child.path}
            node={child}
            depth={depth + 1}
            activePath={activePath}
            onOpen={onOpen}
          />
        ))}
    </>
  );
}
