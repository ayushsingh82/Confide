"use client";

import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";
import type { SandboxBridge } from "./SandboxBridge";

interface Props {
  bridge: SandboxBridge;
  /** An already-opened pty (owned by the parent so Run buttons can also write into it). */
  ptyId: string;
}

export function Terminal({ bridge, ptyId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new XTerm({
      convertEol: true,
      fontSize: 13,
      fontFamily: "ui-monospace, SFMono-Regular, monospace",
      theme: { background: "#000000", foreground: "#d4d4d4" },
      cursorBlink: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    bridge.pty.resize(ptyId, term.cols, term.rows);

    const unsubOutput = bridge.pty.onOutput(ptyId, (data) => term.write(data));
    const unsubExit = bridge.pty.onExit(ptyId, (code) => {
      term.write(`\r\n\x1b[33m[process exited with code ${code}]\x1b[0m\r\n`);
    });
    const dataDisposable = term.onData((data) => bridge.pty.input(ptyId, data));

    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
      bridge.pty.resize(ptyId, term.cols, term.rows);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      dataDisposable.dispose();
      unsubOutput();
      unsubExit();
      term.dispose();
    };
  }, [bridge, ptyId]);

  return <div ref={containerRef} className="h-full w-full px-2 py-1" />;
}
