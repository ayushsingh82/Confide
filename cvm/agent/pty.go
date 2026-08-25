package main

import (
	"os"
	"os/exec"

	"github.com/creack/pty"
)

type ptySession struct {
	id   string
	file *os.File
	cmd  *exec.Cmd
}

const defaultShell = "/bin/bash"

func openPty(cmdStr string, cwd string) (*ptySession, error) {
	shell := cmdStr
	var cmd *exec.Cmd
	if shell == "" {
		cmd = exec.Command(defaultShell)
	} else {
		cmd = exec.Command(defaultShell, "-lc", shell)
	}
	if cwd != "" {
		if abs, err := resolveSafe(cwd); err == nil {
			cmd.Dir = abs
		}
	} else {
		cmd.Dir = workspaceRoot()
	}
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	f, err := pty.Start(cmd)
	if err != nil {
		return nil, err
	}
	return &ptySession{file: f, cmd: cmd}, nil
}

func (p *ptySession) Write(data string) error {
	_, err := p.file.Write([]byte(data))
	return err
}

func (p *ptySession) Resize(cols, rows int) error {
	return pty.Setsize(p.file, &pty.Winsize{Cols: uint16(cols), Rows: uint16(rows)})
}

func (p *ptySession) Close() {
	_ = p.file.Close()
	if p.cmd.Process != nil {
		_ = p.cmd.Process.Kill()
	}
}
