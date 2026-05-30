# Sandbox — How It's Actually Built Today

> Source of truth for *what shipped*. The aspirational design — TDX hosting, WS bridge, attested editor — lives in [`md/08-playground-design.md`](./08-playground-design.md). This doc covers the working code in commit `cd4bde8` and after.

Companion to `plan.md §12` (migration plan to NEAR CVM hosting). Both go in the same direction; this one is just-the-code.

---

## 0. What ships today

Paste a public GitHub URL on `/playground` →
1. Real `git clone --depth=1` into a per-sandbox path-jailed workspace on the backend
2. File tree, click-to-open editor with Cmd/Ctrl+S save, free-form and one-click command runner with output panel
3. Destroy button + auto-sweep wipe the workspace from disk

What's **not** in this version yet and why:

| Missing | Why | Where it lands |
|---|---|---|
| TDX CVM hosting | NEAR doesn't expose a CVM offering today | `plan.md §12.B` — `CVMProvider` interface ready, swap implementation when the partnership lands |
| Streaming exec output | v0 is buffered + capped (60s timeout, 512 KB) — fine for `ls`/`npm install`/`npm test` | Replace with SSE chunked response, then with WS pty bridge once the agent is built |
| In-CVM chat handoff | Today chat lives on `/chat`, not inside the sandbox | `ChatPanel.tsx` inside SandboxView, routes through the CVM agent so prompts don't pass through Confide's proxy |
| Egress allowlist | Local dev runs whatever the OS allows | Enforced inside the CVM image (iptables OUTPUT DROP + allow github/npm/pypi/crates/NEAR/NTP) |

---

## 1. Trust model — truth table

```
┌─────────────────────────────────────────────────────────────┬────────────┐
│ Claim                                                       │ Status     │
├─────────────────────────────────────────────────────────────┼────────────┤
│ Repository cloned into a per-sandbox path-jailed workspace  │ ✅ true    │
│ Other sandboxes cannot read/write its files                 │ ✅ true    │
│ Commands run with timeout + output cap                      │ ✅ true    │
│ Allowlisted command set (no arbitrary paths)                │ ✅ true    │
│ Destroy + sweep wipe the workspace dir within seconds       │ ✅ true    │
│ Closing the tab signals destroy                             │ ⚠️  partial │
│ Chat completions inside workspace route through NEAR's TEE  │ ✅ once    │
│   with a signed attestation receipt                         │    credits │
│                                                             │    funded  │
│ Repository is cloned inside an Intel TDX confidential VM    │ ❌ pending │
│ Browser verifies the VM's TDX quote before unlocking editor │ ❌ pending │
└─────────────────────────────────────────────────────────────┴────────────┘
```

The "tab close → destroy" link is partial because the Beacon API call from the browser is best-effort. The 60s sweep in the backend is the safety net. Both fire in production today.

---

## 2. Backend architecture

```
backend/src/
├── lib/
│   ├── sandbox-fs.ts      ← path jail, tree walk, read/write, removeAll
│   ├── sandbox-exec.ts    ← spawn w/ timeout, output cap, command allowlist
│   └── sandbox-store.ts   ← real git clone, status state machine, lifecycle
└── routes/
    └── sandbox.ts         ← POST /v1/sandbox, GET /v1/sandbox/:id,
                            DELETE /v1/sandbox/:id, GET /v1/sandbox,
                            GET    /v1/sandbox/:id/tree,
                            GET    /v1/sandbox/:id/file?path=…,
                            PUT    /v1/sandbox/:id/file (body: {path, contents}),
                            POST   /v1/sandbox/:id/exec (body: {cmd, args, cwd?, timeoutMs?})
```

### 2.1 `sandbox-fs.ts` — path jail

Every sandbox is rooted at `${DATA_DIR}/sandboxes/<id>/workspace`. The fs module exports four primitives:

```ts
sandboxRoot(id)           // ${DATA_DIR}/sandboxes/<id>
workspaceRoot(id)         // ${DATA_DIR}/sandboxes/<id>/workspace
resolveSafe(id, userPath) // resolves against workspaceRoot, throws if it escapes
listTree(id, maxDepth=5, maxEntries=2000)
readFile(id, userPath)    // 2MB cap, binary detection
writeFile(id, userPath, contents)
removeAll(id)
```

The escape check uses path separator concatenation so `/foo` doesn't match `/foobar`:

```ts
if (!(candidate + path.sep).startsWith(root + path.sep) && candidate !== root) {
  throw new SandboxFsError("Path escapes workspace", 403);
}
```

Tree walk skips `node_modules`, `.git`, `.next`, `dist`, `build`, `.venv` so a freshly-cloned repo with `node_modules` doesn't blow up rendering. Depth + entry caps so a malicious or pathological repo can't DOS the tree endpoint.

Binary detection: scan the first 512 bytes for a null byte. Cheap, catches PNGs / executables / `.wasm`, lets text files of any encoding through.

### 2.2 `sandbox-exec.ts` — command runner

```ts
runCommand(sandboxId, cmd, args, { timeoutMs?, cwd? }): Promise<ExecResult>
```

Three guards stacked:

1. **Allowlist of bare binary names** — `npm`, `pnpm`, `yarn`, `node`, `npx`, `python`, `python3`, `pip`, `pip3`, `go`, `cargo`, `rustc`, `bash -c`, `sh -c`, `ls`, `cat`, `pwd`, `echo`, `grep`, `rg`, `ripgrep`, `git`, `make`, `curl`. Anything with a `/` or `\` in the name is rejected — only bare names allowed.
2. **cwd jailed to workspace** — same `path.resolve` + separator-concat check as fs.
3. **Output cap + wall-clock timeout** — 512 KB per stream, 60s default (max 5 min). Truncation flagged in the response (`stdoutTruncated`, `stderrTruncated`, `timedOut`).

Spawn uses `stdio: ["ignore", "pipe", "pipe"]` and `env: { ...process.env, FORCE_COLOR: "0", CI: "1" }` so `npm install` doesn't try ANSI-color the output and so packages skip interactive prompts.

Kill sequence on timeout: SIGTERM → 2s grace → SIGKILL. Both timers are `.unref()`d so the process doesn't hold the event loop open after exit.

### 2.3 `sandbox-store.ts` — lifecycle

```ts
createSandbox(repoUrl, ttlMs?)  // returns SandboxSession in `queued` state
getSandbox(id)                  // null if missing/expired (auto-sweep on read)
destroySandbox(id)              // marks `destroyed`, wipes workspace dir
listSandboxes()
sweepExpired()                  // marks + wipes any session past expiresAt
```

`createSandbox` synchronously returns the session, then `void boot(id, repoUrl)` runs in the background:

```ts
async function boot(id, repoUrl) {
  try {
    update(id, { status: "spawning" });
    await removeAll(id);                              // clean any prior state
    update(id, { status: "cloning" });
    await gitClone(repoUrl, workspaceRoot(id));       // 120s timeout
    update(id, { status: "ready", attestation: { verified: false } });
  } catch (err) {
    update(id, { status: "error", error: err.message });
  }
}
```

`gitClone` runs `git clone --depth=1 --single-branch <url> <dst>` with `GIT_TERMINAL_PROMPT=0` so the process never blocks waiting for credentials. Shallow + single-branch keeps the clone tight (a 50 MB repo lands as ~3 MB on disk).

The `attestation.verified` flag is `false` today. When NEAR CVM hosting lands, the same field becomes `true` after server-side `dcap-qvl` verification of the TDX quote.

### 2.4 `routes/sandbox.ts`

Eight endpoints. Zod-validates body + query on every one. The four data-access routes (`tree`, `file GET`, `file PUT`, `exec`) all gate on `status === "ready"` via a `readyOr404` helper — anything else returns 409 with the current status, so the frontend can show "still cloning…" without a special case.

```
POST   /v1/sandbox                      { repoUrl, ttlMs? }  →  201 SandboxSession
GET    /v1/sandbox                                            →  { count, sessions }
GET    /v1/sandbox/:id                                        →  SandboxSession | 404
DELETE /v1/sandbox/:id                                        →  204
GET    /v1/sandbox/:id/tree                                   →  { tree } | 409
GET    /v1/sandbox/:id/file?path=…                            →  { contents, size, truncated } | 404 | 409 | 415
PUT    /v1/sandbox/:id/file             { path, contents }    →  { path, size } | 409 | 413
POST   /v1/sandbox/:id/exec             { cmd, args, cwd?,
                                          timeoutMs? }        →  ExecResult | 400 | 403 | 409
```

---

## 3. Frontend architecture

```
frontend/
├── lib/api.ts
│   └── api.sandboxTree, readSandboxFile, writeSandboxFile, exec
└── app/(workspace)/playground/
    ├── page.tsx           ← orchestrator: GitHub OAuth, repo browser, spawn, status stepper
    └── SandboxView.tsx    ← three-pane editor + terminal, rendered when status==='ready'
```

### 3.1 The orchestrator (`page.tsx`)

Two states for the right column under "Start from code":

| `session.status` | What renders |
|---|---|
| `null` (no spawn yet) | Just the URL input + Connect GitHub + repo list |
| `queued / spawning / cloning` | "Provisioning sandbox" stepper |
| `ready` | `<SandboxView>` |
| `error` | Stepper with the git stderr printed |

Polling: while status is transient (queued/spawning/cloning) the page polls `GET /v1/sandbox/:id` every 800ms. Polling stops the moment status leaves the transient set — no busy loop after ready.

### 3.2 `SandboxView` — the actual IDE

Three columns (md+), stacked on mobile:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Sandbox ready  sbx_…  github.com/…  N files                  [Refresh] [Destroy]
├──────────┬──────────────────────────────────────────────┬──────────────────┤
│  Files   │  /src/index.ts          ● (dirty)            │  Run             │
│          │  ┌──────────────────────────────────────┐    │  ────────────    │
│ ▾ src/   │  │ export default function() {           │    │  [ls -la]        │
│   index  │  │   …                                   │    │  [npm install]   │
│   util   │  │ }                                     │    │  [npm run build] │
│ ▾ test/  │  │                                       │    │  [npm test]      │
│   ...    │  │                                       │    │  [python main.py]│
│          │  └──────────────────────────────────────┘    │  [cargo build]   │
│          │                          [Save (⌘S)]         │  [go run .]      │
│          │                                              │  ┌────────────┐  │
│          │                                              │  │ cmd args…  │  │
│          │                                              │  └────────────┘  │
│          │                                              │   [Run]          │
├──────────┴──────────────────────────────────────────────┴──────────────────┤
│  Output                                                                    │
│  $ ls -la · exit 0 · 164ms                                                 │
│  total 1944                                                                │
│  drwxr-xr-x@ 17 ayush  staff  544 30 May 11:17 .                           │
│  ...                                                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

Key behaviors:

- **File tree** — recursive `<TreeRow>` component. Directories open by default at depth 0, then collapsed. File rows are buttons that fire `openFile(path)`.
- **Editor** — plain `<textarea>` for v0 (Monaco lands later). Dirty bit flips on change. Cmd/Ctrl+S saves via `PUT /v1/sandbox/:id/file`. Truncation banner shows when the backend slices the file at the 2MB cap.
- **Run column** — preset buttons for the common commands (`ls -la`, `npm install`, `npm run build`, `npm test`, `python main.py`, `cargo build`, `go run .`) + a free-form `cmd args…` input. The free-form box splits on whitespace and forwards to `POST /v1/sandbox/:id/exec`.
- **Output panel** — one block per exec, oldest at the top, auto-scrolls to the latest. Each block shows `$ cmd args · exit N · Nms`, then `stdout` (neutral text), then `stderr` (red-tinted), then truncation markers if either stream was capped.
- **Refresh tree** after every exec — `npm install` writes `package-lock.json`, which we want to see appear in the tree without a manual reload.

---

## 4. Verifying it works (curl recipe)

```bash
# 1) Spawn
SID=$(curl -s -X POST -H "content-type: application/json" \
  -d '{"repoUrl":"https://github.com/sindresorhus/is"}' \
  http://localhost:4000/v1/sandbox | jq -r .id)

# 2) Poll status
for i in {1..10}; do
  echo "tick $i: $(curl -s http://localhost:4000/v1/sandbox/$SID | jq -r .status)"
  sleep 1
done

# 3) Tree
curl -s http://localhost:4000/v1/sandbox/$SID/tree | jq '.tree.children[0:5]'

# 4) Read
curl -s "http://localhost:4000/v1/sandbox/$SID/file?path=package.json" | jq -r .contents | head

# 5) Exec
curl -s -X POST -H "content-type: application/json" \
  -d '{"cmd":"ls","args":["-la"]}' \
  http://localhost:4000/v1/sandbox/$SID/exec | jq

# 6) Write back
curl -s -X PUT -H "content-type: application/json" \
  -d '{"path":"hello.txt","contents":"world\n"}' \
  http://localhost:4000/v1/sandbox/$SID/file

# 7) Destroy
curl -s -X DELETE http://localhost:4000/v1/sandbox/$SID -i | head -1
```

If any of those return something other than the obvious success, the code is broken — not your machine.

---

## 5. Where the migration to NEAR CVM hosting wires in

The whole sandbox layer was written so swapping the host is a single-file change. From `plan.md §12.B`:

```ts
interface CVMProvider {
  spawn(opts): Promise<{ cvmId, wssUrl, publicKey }>;
  attestationReport(cvmId, nonce): Promise<RawAttestation>;
  destroy(cvmId): Promise<void>;
}
```

Today there's no provider abstraction — `sandbox-store.ts` directly calls `git clone`. When NEAR CVM hosting lands:

1. Extract the current code in `sandbox-store.ts` into `cvm-providers/local.ts`.
2. Write `cvm-providers/near.ts` that calls NEAR's spawn API instead of `git clone` locally.
3. Read `process.env.CVM_PROVIDER` (`local` or `near`) and dispatch at boot.

Routes don't change. `SandboxView` doesn't change. The trust truth-table flips its last two rows from ❌ to ✅. Nothing else moves.

`dcap-qvl` verification of the TDX quote lands in `backend/src/lib/dcap.ts` (also from §12) — gates the JWT release in the spawn handshake.

---

## 6. File map (commit cd4bde8)

```
backend/
├── .gitignore                                   ← + data/sandboxes/
└── src/
    ├── lib/
    │   ├── sandbox-fs.ts        NEW             ← path jail
    │   ├── sandbox-exec.ts      NEW             ← spawn w/ guards
    │   └── sandbox-store.ts     REWRITTEN       ← real git clone + state machine
    └── routes/
        └── sandbox.ts           EXPANDED        ← + tree, file, exec endpoints

frontend/
├── lib/
│   └── api.ts                   EXPANDED        ← + sandboxTree, readSandboxFile, writeSandboxFile, exec
└── app/(workspace)/playground/
    ├── page.tsx                 UPDATED         ← honest trust copy, renders SandboxView when ready
    └── SandboxView.tsx          NEW             ← three-pane editor + terminal
```

---

## 7. Operational caveats while we're still on backend hardware

- **No GPU.** Commands like `nvidia-smi` aren't on the allowlist and there's no GPU in the dev box anyway. The "GPU sandbox SKU" mentioned in §9 of the playground design is gated on TDX hosting.
- **Single-process backend.** All sandboxes share the same Node.js event loop. A `python -c 'while True: pass'` would burn CPU but can't break out — `setTimeout` + SIGKILL kills it after the timeout. For real concurrent users this needs worker processes or moving to per-CVM hosting.
- **Disk usage.** Cloned repos sit in `backend/data/sandboxes/<id>/workspace` until destroyed or swept. The 60s sweeper handles expired sessions; a long-running backend with no traffic still leaks at most one workspace per active session.
- **Network egress is wide open.** Local dev. Inside a CVM, the iptables allowlist in §3 of the design doc kicks in.
- **No persistence across sandbox boundaries.** Each spawn is a fresh clone. Editing then re-spawning loses the edits. Persistence (v1 encrypted snapshots) is in `md/08-playground-design.md §8`.

---

## 8. What this doc commits to *not* doing

Mirror of the anti-patterns from the design doc:

- No marketing copy that overstates capability. The page never says "TDX-attested" until the TDX provider is real.
- No off-allowlist commands. Adding `rm`, `chmod 777`, or `eval` to the allowlist needs a corresponding hardening pass.
- No in-place persistence of the `data/sandboxes/` directory in the repo. Always gitignored.
- No NEAR API key inside a sandbox process. Even when the CVM lands, it'll be a session-scoped JWT lease, not a static secret.
