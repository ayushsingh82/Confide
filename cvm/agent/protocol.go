package main

import "encoding/json"

// ClientFrame is the incoming half of the protocol (md/08-playground-design.md
// §5, mirrored verbatim in backend/src/lib/sandbox-agent-protocol.ts). Every
// field a given frame type doesn't use is left zero and ignored.
type ClientFrame struct {
	Type          string          `json:"type"`
	CorrelationID string          `json:"correlationId,omitempty"`
	Path          string          `json:"path,omitempty"`
	Contents      string          `json:"contents,omitempty"`
	Cmd           string          `json:"cmd,omitempty"`
	Cwd           string          `json:"cwd,omitempty"`
	PtyID         string          `json:"ptyId,omitempty"`
	Data          string          `json:"data,omitempty"`
	Cols          int             `json:"cols,omitempty"`
	Rows          int             `json:"rows,omitempty"`
	Model         string          `json:"model,omitempty"`
	Messages      json.RawMessage `json:"messages,omitempty"`
}

// AgentFrame is the outgoing half. It's a plain map rather than a struct
// because two frame types reuse the JSON key "code" with different value
// types (error.code is a string error code; pty.exit.code is a numeric exit
// code) — a single struct with duplicate json tags would make both fields
// collide and get silently dropped by encoding/json. Each frame type gets a
// small constructor below so callers never hand-build a malformed frame.
type AgentFrame map[string]any

func frameError(correlationID, code, message string) AgentFrame {
	f := AgentFrame{"type": "error", "code": code, "message": message}
	if correlationID != "" {
		f["correlationId"] = correlationID
	}
	return f
}

func framePong(correlationID string) AgentFrame {
	return AgentFrame{"type": "pong", "correlationId": correlationID}
}

func frameFsListResult(correlationID string, entries []fsEntry) AgentFrame {
	return AgentFrame{"type": "fs.list.result", "correlationId": correlationID, "entries": entries}
}

func frameFsReadResult(correlationID, contents string) AgentFrame {
	return AgentFrame{"type": "fs.read.result", "correlationId": correlationID, "contents": contents}
}

func frameFsWriteResult(correlationID string) AgentFrame {
	return AgentFrame{"type": "fs.write.result", "correlationId": correlationID, "ok": true}
}

func frameFsDeleteResult(correlationID string) AgentFrame {
	return AgentFrame{"type": "fs.delete.result", "correlationId": correlationID, "ok": true}
}

func framePtyOpened(correlationID, ptyID string) AgentFrame {
	return AgentFrame{"type": "pty.opened", "correlationId": correlationID, "ptyId": ptyID}
}

func framePtyOutput(ptyID, data string) AgentFrame {
	return AgentFrame{"type": "pty.output", "ptyId": ptyID, "data": data}
}

func framePtyExit(ptyID string, code int) AgentFrame {
	return AgentFrame{"type": "pty.exit", "ptyId": ptyID, "code": code}
}

func frameAttestReportResult(correlationID string, r attestResult) AgentFrame {
	f := AgentFrame{"type": "attest.report.result", "correlationId": correlationID, "mocked": !r.Available}
	if r.Available {
		f["quote"] = r.Quote
		f["spki"] = r.Spki
		f["signingAddress"] = r.SigningAddress
	}
	return f
}
