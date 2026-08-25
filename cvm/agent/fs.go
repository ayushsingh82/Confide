package main

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
)

// workspaceRoot is where the cloned repo lives inside the CVM. Every path
// coming from the browser is resolved against this root and verified to stay
// inside it — mirrors the jail in backend/src/lib/sandbox-fs.ts, since the
// CVM has no separate process boundary to fall back on for this check.
func workspaceRoot() string {
	if v := os.Getenv("WORKSPACE_ROOT"); v != "" {
		return v
	}
	return "/workspace"
}

var errPathEscape = errors.New("path escapes workspace")

func resolveSafe(userPath string) (string, error) {
	root, err := filepath.Abs(workspaceRoot())
	if err != nil {
		return "", err
	}
	cleaned := strings.TrimLeft(userPath, "/")
	candidate := filepath.Join(root, cleaned)
	candidate, err = filepath.Abs(candidate)
	if err != nil {
		return "", err
	}
	if candidate != root && !strings.HasPrefix(candidate, root+string(filepath.Separator)) {
		return "", errPathEscape
	}
	return candidate, nil
}

type fsEntry struct {
	Name  string `json:"name"`
	IsDir bool   `json:"isDir"`
	Size  int64  `json:"size"`
}

func fsList(userPath string) ([]fsEntry, error) {
	abs, err := resolveSafe(userPath)
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(abs)
	if err != nil {
		return nil, err
	}
	out := make([]fsEntry, 0, len(entries))
	for _, e := range entries {
		info, err := e.Info()
		size := int64(0)
		if err == nil {
			size = info.Size()
		}
		out = append(out, fsEntry{Name: e.Name(), IsDir: e.IsDir(), Size: size})
	}
	return out, nil
}

const maxTextBytes = 2 * 1024 * 1024 // 2MB, matches backend/src/lib/sandbox-fs.ts

func fsRead(userPath string) (string, error) {
	abs, err := resolveSafe(userPath)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return "", err
	}
	if info.IsDir() {
		return "", errors.New("not a file")
	}
	f, err := os.Open(abs)
	if err != nil {
		return "", err
	}
	defer f.Close()
	limit := info.Size()
	if limit > maxTextBytes {
		limit = maxTextBytes
	}
	buf := make([]byte, limit)
	if _, err := f.Read(buf); err != nil {
		return "", err
	}
	return string(buf), nil
}

func fsWrite(userPath string, contents string) error {
	abs, err := resolveSafe(userPath)
	if err != nil {
		return err
	}
	if len(contents) > maxTextBytes {
		return errors.New("file too large")
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return err
	}
	return os.WriteFile(abs, []byte(contents), 0o644)
}

func fsDelete(userPath string) error {
	abs, err := resolveSafe(userPath)
	if err != nil {
		return err
	}
	root, err := filepath.Abs(workspaceRoot())
	if err != nil {
		return err
	}
	if abs == root {
		return errors.New("cannot delete workspace root")
	}
	return os.RemoveAll(abs)
}
