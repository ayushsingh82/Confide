package main

import (
	"context"
	"log"
	"net/http"
	"sync"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

const maxPtysPerConn = 4

type connState struct {
	mu   sync.Mutex
	ptys map[string]*ptySession
}

func newConnState() *connState {
	return &connState{ptys: make(map[string]*ptySession)}
}

func (c *connState) addPty(id string, p *ptySession) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.ptys) >= maxPtysPerConn {
		return false
	}
	c.ptys[id] = p
	return true
}

func (c *connState) getPty(id string) (*ptySession, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	p, ok := c.ptys[id]
	return p, ok
}

func (c *connState) removePty(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.ptys, id)
}

func (c *connState) closeAll() {
	c.mu.Lock()
	defer c.mu.Unlock()
	for id, p := range c.ptys {
		p.Close()
		delete(c.ptys, id)
	}
}

// sendFn is a small indirection so pty output goroutines (started per
// pty.open) can write frames without racing the main read loop's writes —
// github.com/coder/websocket connections are safe for one concurrent writer
// and one concurrent reader, so we serialize all writes through this mutex.
type safeConn struct {
	c  *websocket.Conn
	mu sync.Mutex
}

func (s *safeConn) send(ctx context.Context, frame AgentFrame) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := wsjson.Write(ctx, s.c, frame); err != nil {
		log.Printf("ws write error: %v", err)
	}
}

func agentHandler(spkiHash string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			// The agent has no browser-facing CORS story of its own — the
			// backend mints a scoped JWT and the browser dials this socket
			// directly with it in the Authorization header. Origin checks
			// belong at the JWT-verification layer, not here.
			InsecureSkipVerify: true,
		})
		if err != nil {
			log.Printf("ws accept error: %v", err)
			return
		}
		defer c.CloseNow()

		ctx := r.Context()
		sc := &safeConn{c: c}
		state := newConnState()
		defer state.closeAll()

		for {
			var frame ClientFrame
			err := wsjson.Read(ctx, c, &frame)
			if err != nil {
				return // connection closed or errored — closeAll cleans up ptys
			}
			// Dispatch without blocking the read loop on slow work (fs I/O,
			// spawning a shell) — every branch below either returns fast or
			// is itself launched in a goroutine (pty output streaming).
			go handleFrame(ctx, sc, state, spkiHash, frame)
		}
	}
}

func handleFrame(ctx context.Context, sc *safeConn, state *connState, spkiHash string, frame ClientFrame) {
	switch frame.Type {
	case "ping":
		sc.send(ctx, framePong(frame.CorrelationID))

	case "fs.list":
		entries, err := fsList(frame.Path)
		if err != nil {
			sc.send(ctx, frameError(frame.CorrelationID, "fs_error", err.Error()))
			return
		}
		sc.send(ctx, frameFsListResult(frame.CorrelationID, entries))

	case "fs.read":
		contents, err := fsRead(frame.Path)
		if err != nil {
			sc.send(ctx, frameError(frame.CorrelationID, "fs_error", err.Error()))
			return
		}
		sc.send(ctx, frameFsReadResult(frame.CorrelationID, contents))

	case "fs.write":
		if err := fsWrite(frame.Path, frame.Contents); err != nil {
			sc.send(ctx, frameError(frame.CorrelationID, "fs_error", err.Error()))
			return
		}
		sc.send(ctx, frameFsWriteResult(frame.CorrelationID))

	case "fs.delete":
		if err := fsDelete(frame.Path); err != nil {
			sc.send(ctx, frameError(frame.CorrelationID, "fs_error", err.Error()))
			return
		}
		sc.send(ctx, frameFsDeleteResult(frame.CorrelationID))

	case "pty.open":
		p, err := openPty(frame.Cmd, frame.Cwd)
		if err != nil {
			sc.send(ctx, frameError(frame.CorrelationID, "pty_error", err.Error()))
			return
		}
		ptyID := frame.CorrelationID // stable, unique per open request
		if !state.addPty(ptyID, p) {
			p.Close()
			sc.send(ctx, frameError(frame.CorrelationID, "pty_limit", "too many open terminals"))
			return
		}
		sc.send(ctx, framePtyOpened(frame.CorrelationID, ptyID))
		streamPtyOutput(ctx, sc, state, ptyID, p)

	case "pty.input":
		if p, ok := state.getPty(frame.PtyID); ok {
			_ = p.Write(frame.Data)
		}

	case "pty.resize":
		if p, ok := state.getPty(frame.PtyID); ok {
			_ = p.Resize(frame.Cols, frame.Rows)
		}

	case "pty.close":
		if p, ok := state.getPty(frame.PtyID); ok {
			p.Close()
			state.removePty(frame.PtyID)
		}

	case "chat.complete":
		sc.send(ctx, handleChatComplete(frame.CorrelationID))

	case "attest.report":
		sc.send(ctx, frameAttestReportResult(frame.CorrelationID, checkAttestation(spkiHash)))

	default:
		sc.send(ctx, frameError(frame.CorrelationID, "unknown_frame", "unrecognized frame type: "+frame.Type))
	}
}

func streamPtyOutput(ctx context.Context, sc *safeConn, conn *connState, ptyID string, p *ptySession) {
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := p.file.Read(buf)
			if n > 0 {
				sc.send(ctx, framePtyOutput(ptyID, string(buf[:n])))
			}
			if err != nil {
				exitCode := 0
				if ps, waitErr := p.cmd.Process.Wait(); waitErr == nil {
					exitCode = ps.ExitCode()
				}
				sc.send(ctx, framePtyExit(ptyID, exitCode))
				conn.removePty(ptyID)
				return
			}
		}
	}()
}
