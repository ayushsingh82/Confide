/**
 * The WS "agent bridge" protocol — see md/08-playground-design.md §5.
 *
 * This is the SAME protocol a real Go confide-agent (cvm/agent/) will speak
 * from inside a real CVM once one exists. Today, for CVM_PROVIDER=mock, this
 * backend plays the agent's role itself: fs.* is served by sandbox-fs.ts,
 * pty.* by node-pty, chat.complete by the same NEAR proxy logic used by
 * /v1/chat. The frontend's SandboxBridge never needs to know which side of
 * that split it's talking to — only the wssUrl a CVMProvider hands back
 * changes.
 *
 * fs.*, chat.complete, attest.report, ping key on `correlationId` (one
 * request -> one response). pty.* keys on `ptyId` (a persistent stream, not
 * a single response) — see pty.open below, which mints the ptyId server-side
 * and echoes it in `pty.opened`.
 */

import crypto from "node:crypto";
import * as pty from "node-pty";
import type { IPty } from "node-pty";
import { hasNearKey } from "@/config.js";
import {
  listDir,
  readFile,
  removeFile,
  resolveSafe,
  SandboxFsError,
  workspaceRoot,
  writeFile,
} from "@/lib/sandbox-fs.js";
import { ALLOWED_COMMANDS } from "@/lib/sandbox-exec.js";
import { runChatCompletion } from "@/lib/chat-service.js";
import { appendFromReceipt } from "@/lib/usage-store.js";
import type { Message, Receipt } from "@/types/index.js";

export type ClientFrame =
  | { type: "fs.list"; correlationId: string; path: string }
  | { type: "fs.read"; correlationId: string; path: string }
  | { type: "fs.write"; correlationId: string; path: string; contents: string }
  | { type: "fs.delete"; correlationId: string; path: string }
  | { type: "pty.open"; correlationId: string; cmd?: string; cwd?: string }
  | { type: "pty.input"; ptyId: string; data: string }
  | { type: "pty.resize"; ptyId: string; cols: number; rows: number }
  | { type: "pty.close"; ptyId: string }
  | { type: "chat.complete"; correlationId: string; model: string; messages: Message[] }
  | { type: "attest.report"; correlationId: string }
  | { type: "ping"; correlationId: string };

export type AgentFrame =
  | {
      type: "fs.list.result";
      correlationId: string;
      entries: { name: string; isDir: boolean; size: number }[];
    }
  | { type: "fs.read.result"; correlationId: string; contents: string }
  | { type: "fs.write.result"; correlationId: string; ok: true }
  | { type: "fs.delete.result"; correlationId: string; ok: true }
  | { type: "pty.opened"; correlationId: string; ptyId: string }
  | { type: "pty.output"; ptyId: string; data: string }
  | { type: "pty.exit"; ptyId: string; code: number }
  | { type: "chat.complete.result"; correlationId: string; reply: string; receipt: Receipt }
  | {
      type: "attest.report.result";
      correlationId: string;
      mocked: boolean;
      quote?: string;
      spki?: string;
      signingAddress?: string;
    }
  | { type: "error"; correlationId?: string; code: string; message: string }
  | { type: "pong"; correlationId: string };

const MAX_PTYS_PER_CONNECTION = 4;
// Canned "Run" commands only — this is UX (keeps the RunButtons preset list
// honest), not a security boundary. Once pty.open has spawned an
// interactive shell, the shell itself can run anything; the real boundary
// has to live at the CVM/network layer (see plan.md §12 egress allowlist).
const PTY_CMD_ALLOWLIST = new Set(Object.keys(ALLOWED_COMMANDS));

function fsErrorFrame(err: unknown, correlationId: string): AgentFrame {
  if (err instanceof SandboxFsError) {
    return { type: "error", correlationId, code: `fs_${err.status}`, message: err.message };
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return { type: "error", correlationId, code: "fs_error", message };
}

export function createAgentConnection(sandboxId: string, send: (frame: AgentFrame) => void) {
  const ptys = new Map<string, IPty>();

  async function handleFrame(frame: ClientFrame): Promise<void> {
    switch (frame.type) {
      case "ping":
        send({ type: "pong", correlationId: frame.correlationId });
        return;

      case "fs.list": {
        try {
          const entries = await listDir(sandboxId, frame.path);
          send({ type: "fs.list.result", correlationId: frame.correlationId, entries });
        } catch (err) {
          send(fsErrorFrame(err, frame.correlationId));
        }
        return;
      }

      case "fs.read": {
        try {
          const result = await readFile(sandboxId, frame.path);
          send({ type: "fs.read.result", correlationId: frame.correlationId, contents: result.contents });
        } catch (err) {
          send(fsErrorFrame(err, frame.correlationId));
        }
        return;
      }

      case "fs.write": {
        try {
          await writeFile(sandboxId, frame.path, frame.contents);
          send({ type: "fs.write.result", correlationId: frame.correlationId, ok: true });
        } catch (err) {
          send(fsErrorFrame(err, frame.correlationId));
        }
        return;
      }

      case "fs.delete": {
        try {
          await removeFile(sandboxId, frame.path);
          send({ type: "fs.delete.result", correlationId: frame.correlationId, ok: true });
        } catch (err) {
          send(fsErrorFrame(err, frame.correlationId));
        }
        return;
      }

      case "pty.open": {
        if (ptys.size >= MAX_PTYS_PER_CONNECTION) {
          send({
            type: "error",
            correlationId: frame.correlationId,
            code: "pty_limit",
            message: `Too many open terminals (max ${MAX_PTYS_PER_CONNECTION})`,
          });
          return;
        }
        let cwd: string;
        try {
          cwd = frame.cwd ? resolveSafe(sandboxId, frame.cwd) : workspaceRoot(sandboxId);
        } catch (err) {
          send(fsErrorFrame(err, frame.correlationId));
          return;
        }
        if (frame.cmd) {
          const bin = frame.cmd.trim().split(/\s+/)[0];
          if (!bin || !PTY_CMD_ALLOWLIST.has(bin)) {
            send({
              type: "error",
              correlationId: frame.correlationId,
              code: "cmd_not_allowed",
              message: `"${bin ?? ""}" is not on the Run-button allowlist`,
            });
            return;
          }
        }
        const ptyId = crypto.randomUUID();
        const shell = process.env.SHELL ?? "/bin/bash";
        const args = frame.cmd ? ["-lc", `${frame.cmd}; exec ${shell}`] : [];
        let child: IPty;
        try {
          child = pty.spawn(shell, args, {
            name: "xterm-color",
            cols: 80,
            rows: 24,
            cwd,
            env: process.env as Record<string, string>,
          });
        } catch (err) {
          send({
            type: "error",
            correlationId: frame.correlationId,
            code: "pty_spawn_failed",
            message: err instanceof Error ? err.message : "Failed to spawn pty",
          });
          return;
        }
        ptys.set(ptyId, child);
        child.onData((data) => send({ type: "pty.output", ptyId, data }));
        child.onExit(({ exitCode }) => {
          send({ type: "pty.exit", ptyId, code: exitCode });
          ptys.delete(ptyId);
        });
        send({ type: "pty.opened", correlationId: frame.correlationId, ptyId });
        return;
      }

      case "pty.input": {
        ptys.get(frame.ptyId)?.write(frame.data);
        return;
      }

      case "pty.resize": {
        ptys.get(frame.ptyId)?.resize(frame.cols, frame.rows);
        return;
      }

      case "pty.close": {
        const p = ptys.get(frame.ptyId);
        if (p) {
          p.kill();
          ptys.delete(frame.ptyId);
        }
        return;
      }

      case "chat.complete": {
        if (!hasNearKey) {
          send({
            type: "error",
            correlationId: frame.correlationId,
            code: "no_near_key",
            message: "NEAR_API_KEY not configured on the backend",
          });
          return;
        }
        try {
          const { reply, receipt } = await runChatCompletion({
            model: frame.model,
            messages: frame.messages,
          });
          appendFromReceipt(receipt);
          send({ type: "chat.complete.result", correlationId: frame.correlationId, reply, receipt });
        } catch (err) {
          send({
            type: "error",
            correlationId: frame.correlationId,
            code: "near_error",
            message: err instanceof Error ? err.message : "Unknown error",
          });
        }
        return;
      }

      case "attest.report": {
        // MockProvider — this connection is served by the Fastify backend,
        // not a real CVM. No TDX quote exists to return; say so explicitly
        // rather than fabricate one or silently omit the mocked flag.
        send({ type: "attest.report.result", correlationId: frame.correlationId, mocked: true });
        return;
      }
    }
  }

  return {
    handleFrame,
    cleanup(): void {
      for (const p of ptys.values()) p.kill();
      ptys.clear();
    },
  };
}
