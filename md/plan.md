# Project Plan — Confidential AI MVP on NEAR AI Cloud

> Working title: **Confide** (placeholder — rename anytime)
> Infrastructure: NEAR AI Cloud (TEE-backed OpenAI-compatible inference)

---

## 1. Vision

Build a **confidential AI workspace** where every prompt:

1. Routes through NEAR AI Cloud's Trusted Execution Environment (TEE).
2. Returns a cryptographic attestation receipt proving where/how it ran.
3. Leaves no trace — prompts and outputs are never persisted or used for training.

Pitch: *"Stop trusting. Start verifying."*

---

## 2. Scope (MVP)

| In scope | Out of scope (for now) |
|---|---|
| Marketing landing page (dark theme) | Multi-tenant org management |
| Chat UI calling NEAR AI `/v1/chat/completions` | Air-gapped / on-prem deployment |
| Scanner panel showing live attestation receipts | Custom TEE infrastructure |
| Model picker (GLM-4.6, DeepSeek V3.1, GPT-OSS 120B, Qwen3 30B) | FedRAMP / IL5–6 compliance |
| Audit log (per-message receipt history) | VS Code extension (CDE clone) |
| Pricing page | Agent runtime (Studio clone) |

---

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | Mirrors `bestvideo` reference; SSR-friendly |
| UI | React 19 + Tailwind v4 | Tailwind v4 for fast theming |
| Motion | framer-motion | Reveal + nav animations |
| Type system | TypeScript strict | |
| Inference API | NEAR AI Cloud (`cloud-api.near.ai`) | TEE-backed OpenAI-compatible |
| Auth (later) | Magic link / OAuth | Not in v0 |
| Hosting | Vercel | One-click deploy |

---

## 4. Folder Layout

```
near boom/
├── plan.md                   ← this file
├── near-ai-cloud-api.md      ← API reference
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── postcss.config.mjs
    ├── .env.local            ← NEAR_API_KEY lives here (gitignored)
    ├── .env.example
    ├── .gitignore
    └── app/
        ├── layout.tsx
        ├── page.tsx          ← landing
        ├── globals.css
        ├── components/
        │   ├── Navbar.tsx
        │   └── ui/
        │       ├── reveal.tsx
        │       ├── animated-wave.tsx
        │       ├── metrics-section.tsx
        │       └── powered-by.tsx
        ├── chat/
        │   └── page.tsx      ← workspace (chat + scanner)
        └── api/
            └── chat/
                └── route.ts  ← POST → NEAR AI TEE
```

---

## 5. Landing Page Design (Dark Theme)

Direct adaptation of `bestvideo` layout with **one inverted white section** to keep visual rhythm.

| Section | Background | Purpose |
|---|---|---|
| Hero | Black + animated wave | Headline, kicker, dual CTAs |
| How it works | Black | Three-step process: Connect → Run in TEE → Verify receipt |
| **Features** | **White (inverted)** | Hardware isolation, attestation, multi-model, zero retention |
| Metrics | Black | Live counter: 95% <100ms, 100% TEE, <30s attest, 4 models |
| Powered by | Black | Marquee: NEAR AI, GLM, DeepSeek, Intel TDX, H100, TLS 1.3… |
| Use cases | Black | Defense, Finance, Healthcare cards |
| Pricing | Black | Pay-as-you-go ($20 start) / Enterprise ($2,150/seat/mo) |
| Final CTA | Black | "Stop trusting. Start verifying." |
| Footer | Black + wave | Standard nav + legal |

Typography pattern (stolen from bestvideo): mono-uppercase kicker, large serif italic accent words inside headings.

---

## 6. Copy Direction

| Surface | Copy |
|---|---|
| Hero h1 | "Private prompts in, *verified* inference out." |
| Hero sub | "Every prompt runs inside a hardware-isolated TEE on NEAR AI Cloud. Your code, prompts, and data never leave your boundary — every response carries cryptographic proof." |
| Primary CTA | "Open the workspace" |
| Secondary CTA | "See how it works" |
| Features heading | "Everything a gateway does, *attested*." |
| Use cases heading | "Built for teams that *cannot* leak." |
| Pricing heading | "Start small, scale by *verified* call." |
| Final CTA | "Stop trusting. *Start* verifying." |

---

## 7. Chat + Scanner Workspace (`/chat`)

Two-column layout:

```
┌─────────────────────────────┬─────────────────────────┐
│  CHAT                       │  SCANNER                │
│                             │                         │
│  > write a sql migration    │  ✓ TEE: Intel TDX       │
│                             │  ✓ Model: GLM-4.6 FP8   │
│  Sure — here's the…         │  ✓ Hash: a4b2…f019      │
│                             │  ✓ Attested: 12 ms      │
│                             │  ✓ Tokens: 142 in/892 out│
│                             │  ✓ Latency: 837 ms      │
│  [input…]            send   │  [view raw receipt]     │
└─────────────────────────────┴─────────────────────────┘
```

Each user message → POST `/api/chat` → server forwards to `https://cloud-api.near.ai/v1/chat/completions` with `Authorization: Bearer ${NEAR_API_KEY}` → returns model output + attestation metadata.

Scanner card per message shows what NEAR returns; missing fields render as `—` (no fakes).

---

## 8. Integration Plan with NEAR AI

| NEAR endpoint | Used for |
|---|---|
| `POST /v1/chat/completions` | Send the prompt, get the model reply |
| `GET /v1/model/list` | Populate the model dropdown |
| `GET /v1/model/{name}` | Fetch model card (context window, attestation supported, pricing) |
| Attestation endpoints (TBD when key is provided) | Build Scanner cards |

Auth: `Authorization: Bearer sk-...` stored in `.env.local`. Never exposed to the browser — all calls proxy through `/api/chat` and `/api/models`.

---

## 9. Build Order

1. ✅ Audit `bestvideo` for stack + components
2. ✅ Create `frontend/` folder, init Next.js scaffold
3. ⏳ Port UI primitives (Reveal, AnimatedWave, MetricsSection, PoweredBy, Navbar)
4. ⏳ Build dark-themed landing page (`app/page.tsx`)
5. ⏳ `npm install` + `npm run dev` to confirm renders
6. Build `/chat` workspace UI (chat panel + scanner panel)
7. Build `/api/chat` route that proxies to NEAR AI Cloud
8. Wire model picker (calls `GET /v1/model/list`)
9. Persist a local audit log of receipts (browser storage for v0)
10. Polish + deploy to Vercel

---

## 10. Privacy Upgrade — Remove Confide from the Plaintext Path

> **Status:** committed upgrade. The MVP shipped with our `/api/chat` proxy reading prompts in plaintext before forwarding to NEAR. Marketing copy currently says "TLS terminates inside the TEE" (true) but cannot claim "we never see your prompts" (false). This section is the plan to make that second claim defensible.

### Current architecture (what we have today)

```
browser  ──HTTPS──▶  /api/chat (Next.js, our server)  ──HTTPS──▶  cloud-api.near.ai (TEE)
                          ▲
                          │
              TLS terminates here → we
              read req.json() before
              forwarding upstream
```

Trust boundary: the user has to trust **Confide** + NEAR. Two TEEs (gateway + model) protect against NEAR, but our middle hop is a regular Node process.

### Target architecture (what we want)

Trust boundary collapses to **just NEAR** (and the user). Two options:

#### Option A — BYOK + browser-direct (Starter tier)

```
browser  ──HTTPS──▶  cloud-api.near.ai (TEE)
   ▲
   │
   user pastes sk-... once,
   stored in browser only
```

- User pastes their NEAR key on first visit; stored in `localStorage` (or IndexedDB) — never sent to our server.
- Browser calls `cloud-api.near.ai/v1/chat/completions` directly with `Authorization: Bearer sk-...`.
- Our `/api/chat` route is bypassed entirely for Starter users.
- Scanner panel still works — it reads `data.attestation` straight from the NEAR response.

**Pros:** zero changes to backend; cheapest to ship; perfectly honest "we don't see prompts".
**Cons:** key lives in the browser; user has to manage it; CORS depends on NEAR allowing browser origins (likely fine for `cloud-api.near.ai` since their docs show JS clients).

**Risks to verify:**
- CORS preflight on `cloud-api.near.ai` — does it `Access-Control-Allow-Origin: *` for `/v1/chat/completions`? Test before committing.
- XSS would steal the key. Mitigate with strict CSP and `localStorage` over `sessionStorage` choice depending on threat model.

#### Option B — E2EE Chat for hosted Pro tier

NEAR exposes an E2EE Chat Completions endpoint (`Guides > E2EE Chat` in the docs). Approach:

1. Fetch NEAR's enclave public key on session start (signed by TEE attestation).
2. Browser encrypts the prompt body with that key.
3. Browser POSTs ciphertext to our `/api/chat`.
4. Our proxy forwards ciphertext as-is to NEAR's E2EE endpoint.
5. NEAR decrypts inside the TEE, runs inference, encrypts the reply, signs it.
6. We forward ciphertext back to the browser, which decrypts.

```
browser ──ciphertext──▶ /api/chat ──ciphertext──▶ NEAR E2EE TEE
   ▲           (we only see encrypted bytes)         │
   └────────── ciphertext (signed) ──────────────────┘
```

**Pros:** hosted experience (no BYOK), still cryptographically defensible. Keeps the audit dashboard / receipt history that hosted Pro users want.
**Cons:** more code; need to integrate WebCrypto (or libsodium) in the browser; have to handle key-rotation when NEAR rotates the enclave key.

**Implementation notes:**
- Read NEAR's E2EE Chat guide (`md/` — capture this once we have the doc).
- Public-key shape: probably X25519 + AES-GCM (libsodium `crypto_box`-style) — match NEAR's spec exactly.
- Verify the enclave public key against the attestation report's `signing_address` before encrypting — otherwise an attacker MITM-ing our proxy could substitute a key.

### Recommended path

1. **First** — Ship Option A for Starter. Tiny change; one tier becomes provably private. Use it as the demo / pitch artifact.
2. **Then** — Add Option B for Pro. Larger investment but it unlocks the hosted-defensible-privacy claim, which is what enterprise/defense buyers will pay for.

### Tasks

- [ ] **A1:** verify CORS on `cloud-api.near.ai/v1/chat/completions` from a browser fetch
- [ ] **A2:** browser-side key vault (localStorage with optional passphrase + WebCrypto AES-GCM wrap)
- [ ] **A3:** if Starter tier selected, route `/chat` requests to NEAR directly, bypass `/api/chat`
- [ ] **A4:** update Scanner panel to parse NEAR's attestation fields from the browser response
- [ ] **A5:** Starter marketing copy upgrade: "Confide servers never see your prompts — verified"
- [ ] **B1:** fetch NEAR E2EE Chat docs, save into `md/08-e2ee-chat.md`
- [ ] **B2:** browser-side prompt encryption with NEAR's enclave public key (verify key against attestation first)
- [ ] **B3:** Pro tier copy upgrade: "End-to-end encrypted to the TEE; Confide proxies only ciphertext"
- [ ] **B4:** key-rotation handling (refresh enclave key on attestation-cache miss)

### Definition of done

- A `curl` from outside our infrastructure cannot capture a plaintext prompt or reply at any point in the request path for Starter (Option A) or Pro (Option B).
- Marketing copy in `plans` reflects the new guarantee exactly — no over-claims.
- A short note in `README.md` explaining the trust model per tier (BYOK vs E2EE vs hosted with proxy).

---

## 11. Playground — Paste-a-Repo, Run It in a TEE

> **Status:** committed feature, post-MVP. Full engineering design lives at **[`md/08-playground-design.md`](./08-playground-design.md)** — it supersedes the sketch below. The sketch is kept for context; the design doc is the source of truth.

> The pitch: paste any public GitHub URL, we clone it inside a confidential sandbox VM, and the user can edit / run / chat-with-the-code with every inference going through NEAR's TEE. The repo, prompts, and intermediate outputs never leave the TEE boundary.

### User flow

1. User lands on `/playground`.
2. Pastes a GitHub repo URL (or picks a template).
3. We spin up an ephemeral CVM (Intel TDX VM) with that repo cloned.
4. User sees the file tree on the left, an editor in the middle, a chat/terminal on the right.
5. Every AI completion routes through NEAR AI Cloud's TEE.
6. When the session ends, the CVM is destroyed; only the attested receipts are persisted.

```
┌──────────────────┐     ┌──────────────────────────┐     ┌──────────────────────┐
│ User             │     │ Confide playground       │     │ NEAR AI Cloud TEE    │
│  paste URL       │────▶│  /playground             │     │  /v1/chat/completions│
│  https://github  │     │                          │     │  attested            │
│  .com/owner/repo │     │  ┌────────────────────┐  │     │                      │
└──────────────────┘     │  │ Sandbox spawner    │  │     └──────────────────────┘
                          │  │ Intel TDX CVM      │  │                ▲
                          │  │ clones repo,       │  │                │
                          │  │ runs dev server,   │──┼────────────────┘
                          │  │ exposes editor +   │  │      every prompt routed
                          │  │ chat + terminal    │  │      through TEE
                          │  └────────────────────┘  │
                          └──────────────────────────┘
```

### What we need to build

**Front-end (`/playground` route):**
- URL input + "Spin up sandbox" CTA
- File tree (read from the CVM's filesystem via WebSocket or polling)
- Monaco editor for inline edits
- Chat / terminal split panel
- Live status badge ("Sandbox CVM attested ✓ · 14 min remaining")
- Session timer + "Destroy sandbox" button

**Back-end (sandbox orchestration):**
- A spawn API: `POST /api/sandbox` → returns `{ sandboxId, attestation, websocketUrl }`
- A bridge layer that proxies file IO, terminal commands, and chat requests into the CVM
- TTL enforcement (default 30 min) + auto-destroy

**Sandbox CVM image (what runs inside the TEE):**
- Minimal Linux + Node.js + Python + `git`
- A small Go/Rust agent that:
  - Clones the GitHub URL on boot
  - Exposes the workspace over an authenticated WebSocket
  - Pipes chat prompts to `cloud-api.near.ai` with our key
  - Emits an attestation report so the front-end can verify the sandbox is genuine before showing any UI

### Open infrastructure questions

- **Who hosts the CVMs?** Options: Phala Network (already TEE-as-a-service), Azure Confidential VMs, GCP Confidential VMs, run our own bare metal with Intel TDX. Phala is cheapest path to MVP.
- **Network egress from inside the sandbox.** The CVM needs internet to `git clone` and to call NEAR. Locked-down allowlist: `github.com`, `npm`, `pypi`, `cloud-api.near.ai`. Nothing else.
- **State persistence.** v0: nothing persists; users re-clone every session. v1: encrypted snapshots tied to a user account.
- **Resource limits.** CPU / RAM / disk caps per sandbox. Idle timeout.
- **Concurrent sandbox cap per tier.** Starter: 1 active. Pro: 3. Enterprise: 25.

### Trust model

```
User trusts:  Confide UI shell (small)  +  NEAR TEE  +  Sandbox CVM TEE
              └────────────────────────────────────────────────────────┘
                       all verifiable via attestation receipts
```

- The CVM's TDX quote proves "this is a genuine sandbox image" — verifiable via the same attestation pipeline as the model TEE.
- The compose-file hash pins the agent binary; we publish source + Sigstore provenance the same way NEAR does for `cloud-api`.

### Pricing impact

- Starter (BYOK): up to 30 min/day sandbox runtime included; over that, fail gracefully.
- Pro: 10 hr/month sandbox runtime included, then $0.50/hr.
- Enterprise: 400 hr/seat/month (matches Orgn's hourly model).

### Tasks

- [ ] **P1:** prototype CVM image (Linux + git + Node + the agent) running on Phala
- [ ] **P2:** spawn API + websocket bridge in our Next.js backend
- [ ] **P3:** `/playground` front-end with file tree + Monaco editor + chat panel
- [ ] **P4:** attestation handshake in the browser before showing UI (verifies the sandbox CVM is genuine)
- [ ] **P5:** session lifecycle: TTL, idle timeout, destroy button, audit log of session attestations
- [ ] **P6:** egress allowlist (github / npm / pypi / cloud-api.near.ai only)
- [ ] **P7:** per-tier sandbox concurrency caps

### Definition of done

- User pastes a public GitHub URL, clicks one button, gets a working IDE in <60 seconds.
- The browser independently verifies the sandbox's TDX quote before unlocking any UI.
- Every AI completion inside the sandbox shows a NEAR attestation receipt.
- Closing the tab destroys the CVM within 60 seconds; nothing persists by default.

---

## 12. From Mock Spawn → Real VM — Built on NEAR's Stack

> Today: `/playground` shows a mock sandbox stepper after Import. We need the user to *actually* edit and run the code inside a TEE. This section lays out exactly how — and importantly, **using NEAR's own confidential infrastructure** rather than a third-party host.

### Why NEAR (not Phala/Azure directly)

Earlier drafts assumed Phala Cloud as the CVM host. Reconsidered — sticking with NEAR's stack end-to-end is the right call:

1. **Single trust story.** Users already verify NEAR's Intel TDX + H100 attestation receipts for chat completions. Reusing the same TDX + dcap-qvl pipeline for the sandbox means **one attestation surface** to audit, not two.
2. **Same SDK + same image-attestation flow.** NEAR publishes `nearaidev/cloud-api` with Sigstore provenance and a pinned compose file hash (`md/05-gateway-verification.md`). Our `confide-cvm` image follows the same publishing pattern.
3. **Marketing line stays clean** — "every part of the flow runs in a NEAR TEE", not "chat runs in NEAR, sandbox runs in Phala".
4. **Path to a NEAR co-marketing case.** If we ship on their stack, they have a concrete reason to feature us. (Aligned with the credit conversation already happening with their team.)

NEAR doesn't currently expose a *general-purpose* "spawn me a CVM" endpoint — their TEEs run their own model images. So the path is two-phased:

- **Phase 1 — Use what NEAR has now:** the `/v1/attestation/report` endpoint + the Private-ML-SDK image-publishing flow. We deploy `confide-cvm` images to a CVM-hosting layer that exposes the same attestation surface (Phala TDX nodes today, NEAR-hosted CVMs once they open them up — same code path on our side).
- **Phase 2 — Migrate to NEAR-hosted CVMs:** once NEAR opens a "host my CVM" product (or we partner with them to host `confide-cvm` images on NEAR Private LLM Nodes), we flip a single env var. The browser flow, attestation handshake, agent protocol — all unchanged.

This means the design in `md/08-playground-design.md` is still correct end-to-end; the only thing that changes is **which TDX provider boots the CVM**. The user-facing attestation receipt is identical either way (it's the TDX quote — same hardware, same `dcap-qvl` verifier).

### Implementation order

#### A. The CVM image (one-time, then reusable)

| File | Contents |
|---|---|
| `cvm/Dockerfile` | `debian:12-slim` + Node 22 + Python 3.12 + Go 1.23 + cargo + git + curl + ripgrep + the `confide-agent` Go binary |
| `cvm/docker-compose.yml` | Single-service compose so the SHA256 of this file becomes the `mr_config_id` bound into the TDX quote (mirrors how `nearaidev/cloud-api` does it) |
| `cvm/agent/` | Go module — `main.go`, `tls.go` (self-signed cert at boot, SPKI bound into the TDX quote), `attest.go` (read TDX quote via `/dev/tdx-attest`), `ws.go` (multiplexed WS server), `fs.go` (file IO jailed to `/workspace`), `pty.go` (pty multiplexer), `chat.go` (NEAR forwarder using a leased JWT) |
| `.github/workflows/cvm-image.yml` | Build + push to `ghcr.io/ayushsingh82/confide-cvm@sha256:...` with Sigstore signing (`cosign`) |

The publishing flow is the same `mr_config_id = SHA256(app_compose)` + Sigstore provenance pattern documented in `md/05-gateway-verification.md` and `md/06-tls-attestation.md`. **We're not inventing a verification model — we're copying NEAR's exactly so our attestation receipts validate with the same `dcap-qvl` library users already trust.**

#### B. Backend — replace the mock with a real provisioner

`backend/src/lib/cvm-provider.ts` — interface that the sandbox routes call. Two implementations:

```ts
interface CVMProvider {
  spawn(opts: { repoUrl: string; imageDigest: string }): Promise<{
    cvmId: string;
    wssUrl: string;   // wss://<host>/agent
    publicKey: string; // for SPKI pin
  }>;
  attestationReport(cvmId: string, nonce: string): Promise<RawAttestation>;
  destroy(cvmId: string): Promise<void>;
}
```

| Provider | When |
|---|---|
| `MockProvider` | Today — keeps the mock stepper working in dev |
| `PhalaProvider` | First real provider — fastest path to a working CVM since Phala's TDX nodes already expose `dcap-qvl`-compatible quotes |
| `NearProvider` | Drop-in once NEAR opens a sandbox-CVM product (or we partner with them to host `confide-cvm` on their nodes) |

Selection via env var: `CVM_PROVIDER=mock|phala|near`. The route code in `backend/src/routes/sandbox.ts` never changes.

`backend/src/lib/dcap.ts` — wrap `dcap-qvl` (Node bindings) to verify the TDX quote server-side before releasing the WS URL + a session-scoped JWT to the browser. Same library NEAR's own `cvm-compose-files` repo references in its verifier examples.

#### C. The handshake (already designed — see `md/08-playground-design.md §4`)

Walk-through for "Import" on `/playground` after the CVM provider is wired:

1. Browser hits `POST /v1/sandbox` with `repoUrl`.
2. Backend calls `provider.spawn({ repoUrl, imageDigest: PINNED_CVM_DIGEST })`.
3. Provider returns a `wssUrl` and `cvmId`.
4. Backend pulls the TDX quote via `provider.attestationReport(cvmId, nonce)`.
5. Backend runs `dcap.verifyQuote(quote)` — confirms hardware + checks `mr_config_id` matches the SHA256 of our published compose file.
6. Backend mints a 5-min JWT bound to `cvmId + spkiHash` and writes it into the SandboxSession.
7. Frontend polls `GET /v1/sandbox/:id`, sees `status: ready` + `wssUrl` + `jwt`.
8. Browser opens `wss://<cvm>/agent` with `Authorization: <jwt>`.
9. Browser fetches the TDX quote over the same WS connection and re-verifies in-browser (defense in depth — user doesn't have to trust the backend).
10. On match, the UI unlocks: file tree fetched via `fs.list /workspace`, Monaco editor binds, terminal opens via `pty.open`.

#### D. The in-browser IDE pieces

`frontend/app/(workspace)/playground/` gets new components:

| Component | Library | Purpose |
|---|---|---|
| `SandboxBridge.tsx` | native WebSocket | Multiplexes correlationId → response, exposes a typed `bridge.fs.list / fs.read / fs.write / pty.open / pty.input` surface |
| `FileTree.tsx` | none | Calls `bridge.fs.list` recursively, renders an indented tree, click = open in editor |
| `Editor.tsx` | `@monaco-editor/react` | Loads file via `bridge.fs.read`, autosaves via `bridge.fs.write` with debounce |
| `Terminal.tsx` | `xterm` + `xterm-addon-fit` | Open a pty via `bridge.pty.open`, stream stdin/stdout, handle resize |
| `RunButtons.tsx` | none | Quick actions: "npm install", "python main.py", "cargo run" — calls `bridge.pty.open` with cmd preset |
| `ChatPanel.tsx` | none | Reuses the chat UI from `/chat` but routes through `bridge.chat.complete` (so prompts go via the CVM agent → NEAR, never via Confide backend) |

The bridge protocol is already specified in `md/08-playground-design.md §5` — typed `ClientFrame` / `AgentFrame` with correlationIds. No invention needed; just implement it.

### Order of operations to ship

| Step | What | Estimated time | Blocking? |
|---|---|---|---|
| 1 | Write `cvm/Dockerfile` + `cvm/agent/main.go` (TLS bind, WS server skeleton, attest stub) | 1 day | No |
| 2 | Set up GitHub Actions to build + push `confide-cvm` image to GHCR with Sigstore signing | 0.5 day | No |
| 3 | Implement `backend/src/lib/cvm-provider.ts` interface + `MockProvider` (drop-in replacement for current mock) | 2 hr | No |
| 4 | Implement `PhalaProvider` against Phala Cloud SDK (`@phala/dstack`) | 1 day | Phala API credentials (free tier exists) |
| 5 | Implement `backend/src/lib/dcap.ts` with `dcap-qvl` Node bindings | 0.5 day | No |
| 6 | Wire `dcap.verifyQuote` into `/v1/sandbox` to gate the JWT release | 2 hr | Step 5 |
| 7 | Add `chat.complete` handler to `confide-agent` (Go) — forwards to NEAR with leased JWT | 0.5 day | NEAR credits unblocked |
| 8 | Frontend: `SandboxBridge` + `FileTree` + `Editor` (Monaco) | 1 day | No |
| 9 | Frontend: `Terminal` (xterm.js) + `RunButtons` | 0.5 day | No |
| 10 | Frontend: `ChatPanel` reusing the existing chat workspace components | 2 hr | No |
| 11 | E2E test: paste real repo URL, see it clone, edit `package.json`, run `npm install`, chat with the code | — | Steps 1–10 |

**Realistic ship date for a usable in-browser TEE-attested IDE: 5–7 working days from "go".** Two of those depend on external unlocks: Phala credentials (free, fast) and NEAR credits (in progress per the credit conversation).

### What we can ship before NEAR credits unblock

| Already buildable | Blocked on NEAR credits |
|---|---|
| The CVM image + GHCR publishing | The `chat.complete` flow (uses the NEAR key) |
| `PhalaProvider` + dcap verification | End-to-end "chat with the code" demo video |
| File tree, Monaco editor, terminal, run buttons | — |
| Sandbox spawn + attestation handshake | — |

Translation: **80% of the playground IDE is build-able today without any new NEAR credits.** The chat-with-code feature is the only piece blocked, and even that becomes a one-line config change once credits are funded.

### Trust-model invariants (do not break)

These come straight from `md/08-playground-design.md §15` and apply to every shortcut anyone is tempted to take:

- ❌ **No backend code execution.** The cloned repo runs inside the CVM TEE, never on Confide's Fastify backend.
- ❌ **No static NEAR key inside the CVM image.** Always a session-scoped JWT lease — rotated per sandbox.
- ❌ **No "skip attestation in dev mode" toggle.** Local dev runs without a CVM entirely (the mock provider), but when a real CVM is requested, attestation is non-bypassable.
- ❌ **No egress beyond the allowlist** (`github.com`, `npm`, `pypi`, `crates.io`, `cloud-api.near.ai`, NTP).
- ❌ **No persistence of `/workspace` by default.** Sessions are stateless v0; opt-in encrypted snapshots are v1.

---

## 13. Open Questions

- **Real attestation shape**: NEAR's exact response fields for TEE attestation aren't visible without an API key. Need to call `/v1/chat/completions` once with a real key to inspect headers/extra fields.
- **Naming**: `Confide` is placeholder. Real candidates: Sentinel, Vault, Hush, Cipher, Attest.
- **Audit storage**: Per-browser (localStorage) for MVP. Server-side audit DB is post-MVP.
- **Pricing display**: Two-tier marketing copy only, no real Stripe yet.

---

## 14. What's Already Saved

- `near-ai-cloud-api.md` — full API/auth/model/SLA reference compiled from NEAR docs + Scalar client.
- `01-quickstart.md` through `07-api-endpoints.md` — NEAR AI Cloud docs captured from the official site.

---

## 15. Definition of Done (MVP)

- [ ] Landing page renders cleanly in dark theme, mobile + desktop.
- [ ] Chat workspace sends a prompt, gets a real reply from NEAR AI Cloud.
- [ ] Scanner panel shows non-faked attestation/model data per message.
- [ ] No API keys leak to the browser.
- [ ] `npm run build` passes with zero errors.
- [ ] Deployed to a Vercel preview URL.
