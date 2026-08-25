"use client";

import { useEffect, useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import type { SandboxBridge } from "./SandboxBridge";

const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  json: "json",
  md: "markdown",
  py: "python",
  go: "go",
  rs: "rust",
  css: "css",
  html: "html",
  yml: "yaml",
  yaml: "yaml",
  sh: "shell",
  toml: "toml",
};

function languageForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGE_BY_EXT[ext] ?? "plaintext";
}

const SAVE_DEBOUNCE_MS = 800;

interface Props {
  bridge: SandboxBridge;
  path: string;
}

export function FileEditor({ bridge, path }: Props) {
  const [contents, setContents] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValue = useRef("");

  useEffect(() => {
    let cancelled = false;
    setContents(null);
    setError(null);
    setDirty(false);
    bridge.fs
      .read(path)
      .then((c) => {
        if (cancelled) return;
        setContents(c);
        latestValue.current = c;
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Failed to read file"));
    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [bridge, path]);

  async function save() {
    setSaving(true);
    try {
      await bridge.fs.write(path, latestValue.current);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function onChange(value: string | undefined) {
    latestValue.current = value ?? "";
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), SAVE_DEBOUNCE_MS);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-900 bg-neutral-950 px-4 py-2">
        <p className="truncate font-mono text-xs text-neutral-300">
          {path}
          {dirty && <span className="ml-2 text-emerald-400">●</span>}
        </p>
        <span className="shrink-0 text-[0.65rem] uppercase tracking-widest text-neutral-500">
          {saving ? "Saving…" : dirty ? "Unsaved" : "Saved"}
        </span>
      </div>
      {error && (
        <div className="shrink-0 border-b border-red-900/40 bg-red-950/20 px-4 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
      <div className="min-h-0 flex-1">
        {contents === null ? (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">Loading…</div>
        ) : (
          <MonacoEditor
            height="100%"
            language={languageForPath(path)}
            defaultValue={contents}
            theme="vs-dark"
            onChange={onChange}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        )}
      </div>
    </div>
  );
}
