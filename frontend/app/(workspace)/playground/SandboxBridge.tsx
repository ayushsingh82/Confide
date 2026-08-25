"use client";

/**
 * Client for the sandbox agent WS bridge protocol (backend/src/lib/sandbox-agent-protocol.ts,
 * see md/08-playground-design.md §5). Talks to whatever `wssUrl` a
 * CVMProvider handed back on spawn — today that's this same backend acting
 * as MockProvider's agent; once a real CVM lands, `wssUrl` points at the Go
 * confide-agent instead and nothing here changes.
 */

import { useEffect, useRef, useState } from "react";
import type { Message, Receipt } from "@/lib/types";

export interface DirEntry {
  name: string;
  isDir: boolean;
  size: number;
}

// The backend's Receipt (backend/src/types/index.ts) nests attestation
// fields; the frontend's Receipt (lib/types.ts) keeps them flat — same
// mismatch app/api/chat/route.ts already handles for the REST path. Wire
// frames carry the backend shape; `chat.complete()` below flattens it.
interface BackendReceipt {
  id: string;
  model: string;
  latencyMs: number;
  finishReason?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  requestId?: string;
  attestation: { tee?: string; hash?: string; attested: boolean };
  mocked: boolean;
  signature?: Receipt["signature"];
  raw?: unknown;
}

function flattenReceipt(r: BackendReceipt): Receipt {
  return {
    model: r.model,
    latencyMs: r.latencyMs,
    finishReason: r.finishReason,
    usage: r.usage,
    requestId: r.requestId,
    tee: r.attestation.tee,
    attestationHash: r.attestation.hash,
    attested: r.attestation.attested,
    mocked: r.mocked,
    signature: r.signature,
    raw: r.raw,
  };
}

export interface AttestReport {
  mocked: boolean;
  quote?: string;
  spki?: string;
  signingAddress?: string;
}

type ClientFrame =
  | { type: "fs.list" | "fs.read"; correlationId: string; path: string }
  | { type: "fs.write"; correlationId: string; path: string; contents: string }
  | { type: "fs.delete"; correlationId: string; path: string }
  | { type: "pty.open"; correlationId: string; cmd?: string; cwd?: string }
  | { type: "pty.input"; ptyId: string; data: string }
  | { type: "pty.resize"; ptyId: string; cols: number; rows: number }
  | { type: "pty.close"; ptyId: string }
  | { type: "chat.complete"; correlationId: string; model: string; messages: Message[] }
  | { type: "attest.report"; correlationId: string }
  | { type: "ping"; correlationId: string };

type AgentFrame =
  | { type: "fs.list.result"; correlationId: string; entries: DirEntry[] }
  | { type: "fs.read.result"; correlationId: string; contents: string }
  | { type: "fs.write.result" | "fs.delete.result"; correlationId: string; ok: true }
  | { type: "pty.opened"; correlationId: string; ptyId: string }
  | { type: "pty.output"; ptyId: string; data: string }
  | { type: "pty.exit"; ptyId: string; code: number }
  | { type: "chat.complete.result"; correlationId: string; reply: string; receipt: BackendReceipt }
  | ({ type: "attest.report.result"; correlationId: string } & AttestReport)
  | { type: "error"; correlationId?: string; code: string; message: string }
  | { type: "pong"; correlationId: string };

// Plain `Omit` collapses a discriminated union to its common keys; this
// distributes the omission over each member instead so `request()` still
// accepts e.g. `{ type: "fs.read", path }` without `correlationId`.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

class BridgeError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "BridgeError";
  }
}

export class SandboxBridge {
  private ws: WebSocket;
  private pending = new Map<string, { resolve: (f: AgentFrame) => void; reject: (e: Error) => void }>();
  private ptyOutputHandlers = new Map<string, Set<(data: string) => void>>();
  private ptyExitHandlers = new Map<string, Set<(code: number) => void>>();
  private cid = 0;

  constructor(wssUrl: string, jwt: string) {
    const url = new URL(wssUrl);
    url.searchParams.set("token", jwt);
    this.ws = new WebSocket(url.toString());
    this.ws.addEventListener("message", (ev) => this.onMessage(ev));
  }

  waitUntilOpen(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener(
        "error",
        () => reject(new Error("Failed to connect to sandbox agent")),
        { once: true }
      );
    });
  }

  onClose(cb: () => void): void {
    this.ws.addEventListener("close", cb);
  }

  close(): void {
    this.ws.close();
  }

  private onMessage(ev: MessageEvent): void {
    let frame: AgentFrame;
    try {
      frame = JSON.parse(ev.data as string) as AgentFrame;
    } catch {
      return;
    }
    if (frame.type === "pty.output") {
      this.ptyOutputHandlers.get(frame.ptyId)?.forEach((cb) => cb(frame.data));
      return;
    }
    if (frame.type === "pty.exit") {
      this.ptyExitHandlers.get(frame.ptyId)?.forEach((cb) => cb(frame.code));
      this.ptyOutputHandlers.delete(frame.ptyId);
      this.ptyExitHandlers.delete(frame.ptyId);
      return;
    }
    const correlationId = "correlationId" in frame ? frame.correlationId : undefined;
    if (correlationId && this.pending.has(correlationId)) {
      const { resolve, reject } = this.pending.get(correlationId)!;
      this.pending.delete(correlationId);
      if (frame.type === "error") reject(new BridgeError(frame.code, frame.message));
      else resolve(frame);
    }
  }

  private request<T extends AgentFrame>(
    frame: DistributiveOmit<ClientFrame, "correlationId">,
    timeoutMs = 15_000
  ): Promise<T> {
    const correlationId = `c${this.cid++}`;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(correlationId);
        reject(new Error(`Timed out waiting for ${frame.type}`));
      }, timeoutMs);
      this.pending.set(correlationId, {
        resolve: (f) => {
          clearTimeout(timer);
          resolve(f as T);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.ws.send(JSON.stringify({ ...frame, correlationId }));
    });
  }

  fs = {
    list: async (path: string): Promise<DirEntry[]> =>
      (await this.request<Extract<AgentFrame, { type: "fs.list.result" }>>({ type: "fs.list", path })).entries,
    read: async (path: string): Promise<string> =>
      (await this.request<Extract<AgentFrame, { type: "fs.read.result" }>>({ type: "fs.read", path })).contents,
    write: async (path: string, contents: string): Promise<void> => {
      await this.request({ type: "fs.write", path, contents });
    },
    delete: async (path: string): Promise<void> => {
      await this.request({ type: "fs.delete", path });
    },
  };

  pty = {
    open: async (opts: { cmd?: string; cwd?: string } = {}): Promise<string> =>
      (await this.request<Extract<AgentFrame, { type: "pty.opened" }>>({ type: "pty.open", ...opts })).ptyId,
    input: (ptyId: string, data: string): void => {
      this.ws.send(JSON.stringify({ type: "pty.input", ptyId, data }));
    },
    resize: (ptyId: string, cols: number, rows: number): void => {
      this.ws.send(JSON.stringify({ type: "pty.resize", ptyId, cols, rows }));
    },
    close: (ptyId: string): void => {
      this.ws.send(JSON.stringify({ type: "pty.close", ptyId }));
    },
    onOutput: (ptyId: string, cb: (data: string) => void): (() => void) => {
      if (!this.ptyOutputHandlers.has(ptyId)) this.ptyOutputHandlers.set(ptyId, new Set());
      this.ptyOutputHandlers.get(ptyId)!.add(cb);
      return () => this.ptyOutputHandlers.get(ptyId)?.delete(cb);
    },
    onExit: (ptyId: string, cb: (code: number) => void): (() => void) => {
      if (!this.ptyExitHandlers.has(ptyId)) this.ptyExitHandlers.set(ptyId, new Set());
      this.ptyExitHandlers.get(ptyId)!.add(cb);
      return () => this.ptyExitHandlers.get(ptyId)?.delete(cb);
    },
  };

  chat = {
    complete: async (model: string, messages: Message[]): Promise<{ reply: string; receipt: Receipt }> => {
      const frame = await this.request<Extract<AgentFrame, { type: "chat.complete.result" }>>({
        type: "chat.complete",
        model,
        messages,
      });
      return { reply: frame.reply, receipt: flattenReceipt(frame.receipt) };
    },
  };

  attest = {
    report: async (): Promise<AttestReport> => {
      const frame = await this.request<Extract<AgentFrame, { type: "attest.report.result" }>>({
        type: "attest.report",
      });
      return { mocked: frame.mocked, quote: frame.quote, spki: frame.spki, signingAddress: frame.signingAddress };
    },
  };
}

/** Opens (and tears down) a SandboxBridge for the lifetime of the component. */
export function useSandboxBridge(wssUrl: string | undefined, jwt: string | undefined) {
  const [bridge, setBridge] = useState<SandboxBridge | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bridgeRef = useRef<SandboxBridge | null>(null);

  useEffect(() => {
    if (!wssUrl || !jwt) return;
    setError(null);
    setConnected(false);
    const b = new SandboxBridge(wssUrl, jwt);
    bridgeRef.current = b;
    b.waitUntilOpen()
      .then(() => {
        setBridge(b);
        setConnected(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Connection failed"));
    b.onClose(() => setConnected(false));
    return () => {
      b.close();
      bridgeRef.current = null;
    };
  }, [wssUrl, jwt]);

  return { bridge, connected, error };
}
