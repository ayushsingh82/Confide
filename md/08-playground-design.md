# Playground — Design Document

> Goal: a user pastes a public GitHub URL, gets a working IDE in their browser within 60 seconds, runs and edits code, and every line — both their edits and every AI completion — stays inside a hardware-attested Trusted Execution Environment.

This is the engineering design for the feature stubbed at `/playground`. Read this before touching the actual implementation.

---

## 1. User Journey

1. User lands on `/playground`.
2. Pastes `https://github.com/owner/repo` and clicks **Import**.
3. UI shows a stepped status: *Repository URL accepted → Spawning confidential VM → Cloning → Attesting → Ready*.
4. Once the CVM is attested, the UI unlocks: file tree on the left, code editor in the middle, terminal + chat on the right.
5. User can `npm install`, `python main.py`, `cargo run`, etc. — every command executes inside the CVM.
6. Every AI completion ("explain this function", "fix this test") is routed through NEAR's TEE and comes back with a signed receipt.
7. User closes the tab → CVM is destroyed within 60 seconds.
8. Nothing persists by default.

---

## 2. System Architecture

```
┌────────────────────────────────────┐    ┌────────────────────────────────────┐    ┌──────────────────────────────┐
│ BROWSER (Confide IDE)              │    │ CONFIDE BACKEND (Fastify)          │    │ NEAR AI CLOUD                │
│                                    │    │                                    │    │                              │
│  ┌─────────────────────────────┐   │    │  ┌─────────────────────────────┐   │    │  ┌────────────────────────┐  │
│  │ /playground                  │   │    │  │ POST /v1/sandbox             │───┼────┼─▶│ Attestation endpoint   │  │
│  │  - URL input + Import        │───┼───▶│  │ (validate + call Phala)      │   │    │  │ /v1/attestation/report │  │
│  │  - Status pane               │   │    │  └────────────┬────────────────┘   │    │  └────────────────────────┘  │
│  │  - File tree + editor + term │   │    │               │                    │    │                              │
│  │  - Chat panel                │   │    │  ┌────────────▼────────────────┐   │    │  ┌────────────────────────┐  │
│  └──┬──────────────────────▲────┘   │    │  │ Phala / Azure CC adapter    │   │    │  │ /v1/chat/completions   │  │
│     │                      │        │    │  │  spawn / status / destroy   │   │    │  │ inside model TEE       │  │
│     │ wss (auth + payload) │        │    │  └────────────┬────────────────┘   │    │  └────────────────────────┘  │
│     │ direct to the CVM    │        │    │               │                    │    └──────────────────────────────┘
│     │                      │        │    │  ┌────────────▼────────────────┐   │                  ▲
│     │   1️⃣  spawn request   │        │    │  │ Sandbox session store        │   │                  │
│     │   4️⃣  ws upgrade      │        │    │  │ (data/sandboxes.jsonl)       │   │                  │
│     └──────────────────────┼────────┘    │  └─────────────────────────────┘   │                  │
│                            │             │                                    │                  │
└────────────────────────────┼─────────────└──┬────────────────────────────────┘                  │
                             │                │                                                    │
                             │ 2️⃣  spawn CVM   │                                                    │
                             │                ▼                                                    │
            ┌────────────────┴──────────────────────────────────────────────────────────────────────┴────┐
            │ TEE SANDBOX (Phala / Azure CC — Intel TDX confidential VM)                                  │
            │                                                                                              │
            │  ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────────────────┐ │
            │  │ confide-agent (Go)   │   │ /workspace            │   │ runtimes                          │ │
            │  │  - WS server (TLS)   │◀──│   cloned repo lives   │   │  Node 22, Python 3.12, Go 1.23,   │ │
            │  │  - file IO           │   │   here                │   │  cargo, git, curl                 │ │
            │  │  - pty multiplexer   │   └──────────────────────┘   └──────────────────────────────────┘ │
            │  │  - chat passthrough  │                                                                    │
            │  │  - attestation rpt   │   ┌─────────────────────────────────────────────────────────────┐ │
            │  └──────────┬───────────┘   │ egress allowlist (iptables)                                 │ │
            │             │               │   github.com, npm, pypi, crates.io, cloud-api.near.ai, NTP  │ │
            │             │               └─────────────────────────────────────────────────────────────┘ │
            │             ▼                                                                                │
            │  3️⃣  TDX quote signed by CPU + GPU attestation if NVIDIA CC present                          │
            └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Trust boundary**: the browser trusts the **CVM TEE** (hardware-attested) and the **NEAR TEE** (also hardware-attested). It does not need to trust the Phala/Azure operator or Confide's backend after attestation completes — the WS connection terminates inside the CVM.

---

## 3. The CVM Image

A reproducible OCI image, pinned by digest, deployed to the TEE.

| Component | Notes |
|---|---|
| **Base** | `debian:12-slim` (~80 MB) — small enough for fast cold starts, enough libc for Node/Python/Go |
| **Runtimes** | Node.js 22 (managed via fnm), Python 3.12, Go 1.23, cargo, git, curl, ripgrep |
| **`confide-agent`** | Single Go binary (~12 MB) — owns the TLS endpoint, WS server, file/pty bridge, NEAR proxy |
| **TLS** | Self-signed cert generated at first boot inside the TEE. SPKI hash gets bound into the TDX quote (`include_tls_fingerprint=true` style) |
| **NVIDIA CC** | Optional — only needed when the user wants GPU-bound completions inside the sandbox. Most workloads don't need GPU |
| **Egress firewall** | iptables OUTPUT chain — default DROP, ACCEPT only the allowlist below |
| **Inactivity reaper** | systemd timer — destroy self if no WS frames in 10 min |
| **Filesystem layout** | `/workspace` (cloned repo), `/etc/confide/agent.toml` (config), `/var/log/agent.log` |

The image is built via GitHub Actions (reproducibly), pushed to `ghcr.io/ayushsingh82/confide-cvm@sha256:...`, and the **digest is what we attest against**. Source provenance via Sigstore — the same model NEAR uses for `cloud-api`.

### Egress allowlist

| Host pattern | Why |
|---|---|
| `github.com`, `objects.githubusercontent.com` | git clone, releases |
| `registry.npmjs.org`, `*.npmjs.com` | npm install |
| `pypi.org`, `files.pythonhosted.org` | pip install |
| `proxy.golang.org`, `sum.golang.org` | go mod download |
| `crates.io`, `static.crates.io` | cargo |
| `cloud-api.near.ai` | NEAR AI inference |
| `pool.ntp.org` | clock sync |
| `nras.attestation.nvidia.com` | GPU attestation (when NVIDIA CC is on) |

Everything else: **DROP**. Audit logged.

---

## 4. Spawn Handshake

Sequence from "Import" click to "editor unlocked".

```
Browser                Confide backend          Phala API              CVM
   │                         │                       │                   │
   │── POST /v1/sandbox ────▶│                       │                   │
   │   { repoUrl }           │                       │                   │
   │                         │── POST /vm/create ───▶│                   │
   │                         │   { image_digest }    │                   │
   │                         │                       │─ provision ──────▶│
   │                         │                       │                   │
   │                         │◀─ 201 { cvm_id,       │                   │
   │                         │     ip_addr }         │                   │
   │                         │                       │                   │
   │◀── 201 { sessionId,     │                       │                   │
   │   status: "queued" }    │                       │                   │
   │                         │                       │                   │
   │── GET /v1/sandbox/:id ──┼── (poll while         │                   │
   │   (poll every 1s)       │   status != ready)    │                   │
   │                         │                       │                   │
   │                         │                       │   boot ───────────▶│
   │                         │                       │                   │ confide-agent starts
   │                         │                       │                   │ generates TLS cert
   │                         │                       │                   │ binds SPKI into TDX quote
   │                         │                       │                   │ clones {repoUrl} → /workspace
   │                         │                       │                   │
   │                         │── GET /v1/attestation ┼─────────────────▶│ (via Phala proxy)
   │                         │                       │                   │
   │                         │◀── { tdx_quote, spki, signing_addr, ... } │
   │                         │                       │                   │
   │                         │ verify TDX quote via                       │
   │                         │ dcap-qvl, check       │                   │
   │                         │ mr_config_id matches  │                   │
   │                         │ pinned image digest   │                   │
   │                         │                       │                   │
   │                         │ mint JWT bound to     │                   │
   │                         │ sessionId + SPKI      │                   │
   │                         │                       │                   │
   │◀── { status: "ready",   │                       │                   │
   │    wssUrl, spkiHash,    │                       │                   │
   │    jwt }                │                       │                   │
   │                         │                       │                   │
   │── wss://{cvm-ip}/agent ─┼───────────────────────┼──────────────────▶│
   │   (Authorization: jwt)  │                       │                   │
   │                         │                       │                   │
   │ verify cert SPKI ≡ spkiHash from step 5 (defense-in-depth)            │
   │ verify attestation again over the WS (same trick as NEAR's chat verify)│
   │                         │                       │                   │
   │── attest:report ───────▶│                       │  ───────────────▶│
   │◀── { quote }            │                       │                   │
   │                         │                       │                   │
   │ unlock UI               │                       │                   │
```

**Why both backend and browser verify?** Defense in depth. Backend verification is cheap, fast (1 round trip on a warm dcap-qvl cache), and gates the WS URL release. Browser verification is the user's ground truth — they don't need to trust us either.

---

## 5. WebSocket Bridge Protocol

The browser opens a single multiplexed WS to `confide-agent`. JSON frames, request/response keyed by `correlationId`.

```ts
// Outbound (browser → CVM)
type ClientFrame =
  | { type: "fs.list";  correlationId: string; path: string }
  | { type: "fs.read";  correlationId: string; path: string }
  | { type: "fs.write"; correlationId: string; path: string; contents: string }
  | { type: "fs.delete"; correlationId: string; path: string }
  | { type: "pty.open"; correlationId: string; cmd?: string; cwd?: string }
  | { type: "pty.input"; ptyId: string; data: string }
  | { type: "pty.resize"; ptyId: string; cols: number; rows: number }
  | { type: "pty.close"; ptyId: string }
  | { type: "chat.complete"; correlationId: string; model: string; messages: Message[] }
  | { type: "attest.report"; correlationId: string }
  | { type: "ping"; correlationId: string };

// Inbound (CVM → browser)
type AgentFrame =
  | { type: "fs.list.result";  correlationId: string; entries: { name: string; isDir: boolean; size: number }[] }
  | { type: "fs.read.result";  correlationId: string; contents: string }
  | { type: "fs.write.result"; correlationId: string; ok: true }
  | { type: "pty.opened"; correlationId: string; ptyId: string }
  | { type: "pty.output"; ptyId: string; data: string }
  | { type: "pty.exit"; ptyId: string; code: number }
  | { type: "chat.complete.result"; correlationId: string; reply: string; receipt: Receipt }
  | { type: "attest.report.result"; correlationId: string; quote: string; spki: string; signingAddress: string }
  | { type: "error"; correlationId?: string; code: string; message: string }
  | { type: "pong"; correlationId: string };
```

**Why route `chat.complete` through the CVM instead of straight from the browser to NEAR?**
Because the CVM is the one with the trust boundary the user cares about. From the user's perspective, the prompt enters the CVM (already inside a TEE) and re-exits to NEAR's TEE — no plaintext ever lives on the public network or in Confide's backend. (Optional later: also expose a direct browser→NEAR path for BYOK users who don't need code execution.)

---

## 6. Threat Model

| Adversary | What they want | How we defend |
|---|---|---|
| **Confide operator** (us) | Read prompts, code, or completions | After attestation, browser talks WS directly to the CVM — backend is out of the path. Backend never sees `/workspace` contents. |
| **Phala / Azure operator** | Read CVM memory | Intel TDX hardware isolation — CPU encrypts memory pages. Operator can see only ciphertext. |
| **Network adversary** | Sniff or MITM the WS | TLS terminates inside the CVM TEE (SPKI bound into the TDX quote). MITM with a different cert is detected at the SPKI check. |
| **Malicious repo** | Exfiltrate user input or NEAR key via the cloned code | Egress allowlist blocks every host except git/npm/pypi/crates/NEAR/NTP. NEAR key never enters the CVM — `chat.complete` is forwarded by the agent which holds the key from a JWT-scoped lease. |
| **Malicious NPM package** | Exfiltrate prompt content | Same — egress allowlist. Plus: agent doesn't read the user's prompts off `/workspace`; prompts flow over WS, the agent only forwards them. |
| **Replay attacks on attestation** | Pin a stale TDX quote | Nonce in the attestation request (random 32 bytes per call), bound into `report_data[32:64]`. |
| **Compromised CVM image** | Run a backdoored agent | `mr_config_id` = `SHA256(app_compose)` is in the TDX quote. Browser checks the digest matches the pinned image we published. Sigstore provenance for `confide-agent`. |
| **Closing the tab leaks state** | Persistent residue on Phala disks | CVMs are stateless by default. On destroy, Phala wipes the disk. No backups. |

---

## 7. Lifecycle

| Phase | Default | Max | Trigger |
|---|---|---|---|
| Spawn → Ready | <60s | 120s timeout → mark error | POST /v1/sandbox |
| Idle warn | after 5 min of no WS frames | banner: "Sandbox idle. Activity in 5 min or it'll be destroyed." | tick in agent |
| Idle destroy | after 10 min idle | non-overridable | agent → DELETE /v1/sandbox/:id |
| TTL | 30 min | 2 hr (Pro), 8 hr (Enterprise) | spawn-time arg |
| Explicit destroy | immediate | — | DELETE endpoint or close-tab heartbeat loss |
| Sweeper | every 60s | — | backend cron — `sweepExpired()` |

On destroy: agent sends `bye`, WS closes, Phala terminates the CVM, backend writes a final sandbox event to `data/sandboxes.jsonl` with `destroyedAt` and `finalAttestationHash`.

---

## 8. State Persistence

| Version | What persists | Where |
|---|---|---|
| v0 (MVP) | Nothing. Every session is fresh. | — |
| v1 | Encrypted `/workspace` snapshot on destroy, restorable on next spawn | S3 bucket; encryption key is `KDF(user_id ‖ TEE-sealed_secret)`. The Confide backend can't decrypt without the user's session. |
| v2 | Live collaborative — multiple browsers attach to the same CVM | Per-CVM WS room, conflict-free editor (Y.js inside agent) |

---

## 9. Pricing Integration

| Tier | Sandbox runtime included | Overage | Concurrent sandboxes |
|---|---|---|---|
| Starter (BYOK) | 30 min/day | hard cutoff | 1 |
| Pro ($29/mo) | 10 hr/month | $0.50/hr after that | 3 |
| Enterprise ($1,500/seat/mo) | 400 hr/seat/month | included; soft cap at 600 | 25 per seat |

Cost basis: Phala TDX VMs at ~$0.30–0.80/hr depending on size. Pricing above assumes 2 vCPU / 4 GB / 20 GB disk default. GPU-attached sandbox is a separate SKU.

---

## 10. Backend API Surface

Already scaffolded in `backend/src/routes/sandbox.ts`. Concrete endpoints:

| Method + Path | Body / Query | Returns |
|---|---|---|
| `POST /v1/sandbox` | `{ repoUrl: string; ttlMs?: number; size?: "sm"\|"md"\|"lg"; gpu?: boolean }` | `SandboxSession` |
| `GET /v1/sandbox/:id` | — | `SandboxSession` (includes `wssUrl` + `jwt` once status = ready) |
| `DELETE /v1/sandbox/:id` | — | 204 |
| `GET /v1/sandbox` | — | `{ count, sessions[] }` (debug/admin) |
| `POST /v1/sandbox/:id/extend` | `{ extraMs: number }` | `SandboxSession` with updated `expiresAt` |
| `GET /v1/sandbox/:id/attestation` | — | full TDX + GPU verifier output |

The current stubs return mock state; the real implementations wrap a Phala SDK adapter (`backend/src/lib/phala.ts`, not yet written).

---

## 11. Phased Build Plan

| Phase | Scope | Status |
|---|---|---|
| **P0** | UI placeholder at `/playground` (paste URL + status stepper), mock spawn API, plan committed | ✅ shipped |
| **P1** | Phala SDK adapter, real CVM provisioning, backend dcap-qvl verification, signed JWT | ⏳ next |
| **P2** | WS bridge protocol implemented in `confide-agent` (Go), file tree + Monaco editor in the browser | ⏳ |
| **P3** | Terminal multiplexing (xterm.js + pty) + run buttons (`npm install`, `python main.py`, …) | ⏳ |
| **P4** | Chat panel inside playground — `chat.complete` over the WS, receipts shown in the right rail | ⏳ |
| **P5** | Egress allowlist enforced in CVM image, audit log written to `data/sandboxes.jsonl` | ⏳ |
| **P6** | State persistence v1 (encrypted snapshots) | ⏳ |
| **P7** | Collaborative editing v2 (Y.js inside agent) | ⏳ |

---

## 12. Open Decisions (Need User Input)

1. **CVM host**: Phala for MVP vs Azure Confidential VMs for scale? Phala wins on speed-to-MVP; Azure wins on enterprise SLAs.
2. **Editor**: Monaco (heavier, VS Code parity) or CodeMirror 6 (lighter, faster startup)? Monaco probably wins for the demo.
3. **GPU sandbox SKU**: ship v0 without GPU, or include it day-one? GPU CVMs cost 5–10× more.
4. **Auth**: per-sandbox JWT requires Confide accounts. For unauth'd demos, do we issue an anonymous session token tied to the browser? (Yes for MVP, gate persistence on real auth.)
5. **Repo limits**: cap clone size at 500 MB? 1 GB? Refuse private repos for v0?
6. **Multi-file edits + chat**: should chat have edit-the-file affordance (apply diff inside the CVM)? That unlocks "agent-coding" — closer to Claude Code in a TEE.

---

## 13. Definition of Done

- User pastes a public GitHub URL, clicks **Import**, sees a working IDE within 60 seconds.
- Browser independently verifies the CVM's TDX quote before showing any file content.
- Every AI completion inside the sandbox is signed by NEAR's TEE and surfaces a verifiable receipt.
- Closing the tab destroys the CVM within 60 seconds. No backups, no residue.
- Audit log per session: created/destroyed timestamps, attestation hashes, total tokens spent.
- Marketing copy on `/playground` matches the actual trust model (no over-claims).

---

## 14. Files To Create

```
backend/
├── src/lib/
│   ├── phala.ts             ← Phala SDK adapter (spawn / status / destroy / attestation)
│   ├── jwt.ts               ← mint / verify session JWTs bound to sandboxId + SPKI
│   └── dcap.ts              ← dcap-qvl wrapper for TDX quote verification
└── src/routes/
    └── sandbox.ts           ← already scaffolded; will be expanded with real Phala calls

cvm/
├── Dockerfile               ← debian:12-slim + Node + Python + Go + agent binary
├── docker-compose.yml       ← what Phala/Azure deploys (hash bound into mr_config_id)
└── agent/                   ← Go module
    ├── main.go              ← entrypoint, TLS bind, WS server
    ├── tls.go               ← self-signed cert + SPKI bind
    ├── attest.go            ← TDX quote fetch via /dev/tdx-attest
    ├── fs.go                ← file IO with /workspace jail
    ├── pty.go               ← pty multiplexer
    └── chat.go              ← NEAR forwarder (holds key from leased JWT)

frontend/
└── app/(workspace)/playground/
    ├── page.tsx             ← already scaffolded; expand to render editor + terminal once status=ready
    ├── SandboxBridge.tsx    ← WS client + correlationId multiplexer
    ├── FileTree.tsx
    ├── Editor.tsx           ← Monaco wrapper
    ├── Terminal.tsx         ← xterm.js wrapper
    └── ChatPanel.tsx
```

---

## 15. Anti-Patterns We Refuse

- ❌ Running the cloned code on Confide's backend "for convenience" — destroys the trust story.
- ❌ Storing the NEAR API key inside the CVM image — it's a lease, scoped per-session, rotated.
- ❌ Letting the browser fall back to "I trust Confide" if attestation fails — block the UI instead.
- ❌ Allowing arbitrary outbound HTTP from the CVM — egress allowlist is non-negotiable.
- ❌ Persisting `/workspace` by default — opt-in only, and encrypted at rest with a key the operator doesn't hold.
- ❌ A "skip attestation in dev mode" toggle — there's no dev-mode bypass. Local dev runs without a CVM at all (mock).

---

## Related Docs

- `04-private-inference.md` — how NEAR's TEE works under the hood
- `06-tls-attestation.md` — the verification recipe we mirror for the CVM
- `plan.md §10` — privacy upgrade for browser-direct chat (separate from playground)
- `plan.md §11` — original playground sketch, now superseded by this doc
