# Confide — The Confidential AI IDE

> Code with AI. Prove nothing leaked.

Confide is an IDE that routes every AI completion through a hardware-isolated
Trusted Execution Environment (TEE) on **NEAR AI Cloud**. Your code, prompts,
and context never leave your boundary — and every reply ships with a
cryptographic attestation receipt you can verify in under 30 seconds.

Built on the open NEAR AI stack.

---

## What we're building

| Surface | Status | Description |
|---|---|---|
| **Landing page** | ✅ shipped | Dark marketing site — hero w/ NEAR pill, features, metrics, pricing tiers w/ real margins, silver MagicRings CTA, footer |
| **Workspace shell** | ✅ shipped | Left sidebar (Chat / Playground / Browse Models / Usage / Settings) + top bar with profile menu + "NEAR TEE connected" badge |
| **`/chat` workspace** | ✅ shipped | Chat panel + live Scanner panel; per-message attestation receipts (model, TEE, hash, latency, tokens); 5-model picker with real NEAR IDs |
| **`/playground`** | ✅ shipped (mock CVM) | Paste GitHub URL → spawn confidential sandbox. Status pane stepper; trust-model explainer; real Phala/Azure spawn is P1 |
| **`/browse-models`** | ✅ shipped | NEAR-only catalog (40 models) with real provider logos for Anthropic / Google / DeepSeek / OpenAI / Qwen / GLM; search + category + creator filters |
| **`/usage`** | ✅ shipped | Square stat grid (Agent Runs / Sessions / Tokens / USD) backed by per-request UsageEvent log; time-range tabs; per-day bar chart; per-model leaderboard |
| **`/settings/profile`** | ✅ shipped | Avatar, linked emails with Primary/OAuth/Verified pills, danger zone |
| **GitHub OAuth** | ✅ shipped | Connect GitHub from `/playground`, browse your repos, one-click import to spawn a sandbox. End users never see secrets — see [md/09-github-oauth.md](./md/09-github-oauth.md) |
| **Backend service** | ✅ shipped | Fastify on `:4000` — `/v1/chat` (NEAR proxy), `/v1/usage/*`, `/v1/models`, `/v1/attestation/report`, `/v1/sandbox/*`, `/v1/auth/github/*`, `/v1/github/repos` |
| **Token usage tracking** | ✅ shipped | Backend appends `UsageEvent` per chat to `data/usage.jsonl`; cost computed from NEAR per-million pricing; `/usage/summary` returns totals + by-day + leaderboard in one call |
| **Real CVM spawn (Phala adapter)** | ⏳ next | Replace the mock spawn with real TDX VMs — see [md/08-playground-design.md](./md/08-playground-design.md) phased plan |
| **In-VM editor + terminal** | ⏳ next | Monaco editor + xterm.js terminal in browser, WS bridge to `confide-agent` Go binary inside the CVM |
| **Frontend → backend chat handoff** | ✅ shipped | `frontend/app/api/chat/route.ts` proxies to `backend:4000/v1/chat`; backend now also fetches the per-message NEAR signature (`GET /v1/signature/{chat_id}`) so attestation + usage events persist to `data/usage.jsonl` |
| **Privacy upgrade (E2EE / BYOK direct)** | later | Cut Confide's proxy out of the plaintext path — see [md/plan.md §10](./md/plan.md) |
| **Pricing / Stripe** | later | Marketing copy only; pricing math is in the landing tiers |
| **VS Code extension** | later | Real CDE clone after the web IDE is solid |

---

## Architecture

### Side-by-side: today vs Confide

```
  YOUR LAPTOP                           CONFIDE (this repo)                    NEAR AI CLOUD
  ┌─────────────────┐                   ┌───────────────────┐                  ┌──────────────────────┐
  │                 │                   │                   │                  │ ┌──────────────────┐ │
  │  Code editor    │ ── prompt ──▶     │  Next.js IDE      │ ── HTTPS ──▶    │ │  Intel TDX TEE   │ │
  │  + AI plugin    │                   │  /api/chat        │  (sk-... key)    │ │  + H100 CC GPU   │ │
  │                 │ ◀── reply ──      │                   │ ◀── receipt ──   │ │  + GLM-4.6 / …   │ │
  └─────────────────┘                   └───────────────────┘                  │ └──────────────────┘ │
         │                                       │                              │         │            │
         ▼                                       ▼                              │         ▼            │
   ┌──────────┐                          ┌──────────────┐                       │  Attestation        │
   │ Provider │                          │  Scanner UI  │                       │  (signed by TEE)    │
   │ sees     │                          │  shows the   │                       └──────────────────────┘
   │ your raw │                          │  receipt     │
   │ code 😱  │                          │  per message │
   └──────────┘                          └──────────────┘
```

### Component diagram

```
┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────────┐
│ USER DEVICE              │   │ CONFIDE SERVER           │   │ NEAR AI CLOUD                │
│                          │   │                          │   │                              │
│  ┌────────────────────┐  │   │  ┌────────────────────┐  │   │  ┌────────────────────────┐  │
│  │ Confide IDE        │──┼───┼─▶│ /api/chat          │──┼───┼─▶│ Gateway                │  │
│  │ Next.js + React 19 │  │   │  │ Next.js route      │  │   │  │ OpenAI-compatible      │  │
│  └─────────▲──────────┘  │   │  └─────────┬──────────┘  │   │  └───────────┬────────────┘  │
│            │             │   │            │             │   │              ▼               │
│  ┌─────────┴──────────┐  │   │  ┌─────────▼──────────┐  │   │  ┌────────────────────────┐  │
│  │ Scanner UI         │◀─┼───┼──│ Attestation parser │  │   │  │ Intel TDX TEE          │  │
│  │ attestation panel  │  │   │  └────────────────────┘  │   │  │ + H100 CC GPU          │  │
│  └────────────────────┘  │   │                          │   │  │   ├─ GLM-4.6 FP8       │  │
└──────────────────────────┘   └──────────────────────────┘   │  │   ├─ DeepSeek V3.1     │  │
                                                              │  │   ├─ GPT-OSS 120B      │  │
                                                              │  │   └─ Qwen3 30B         │  │
                                                              │  └───────────┬────────────┘  │
                                                              │              ▼               │
                                                              │  ┌────────────────────────┐  │
                                                              │  │ Attestation service    │  │
                                                              │  │ signs receipt          │  │
                                                              │  └────────────────────────┘  │
                                                              └──────────────────────────────┘
```

### Sequence — a single prompt's lifecycle

```
   Developer        Confide IDE       /api/chat        NEAR TEE        Scanner
       │                │                 │                │              │
       │── type ───────▶│                 │                │              │
       │   prompt       │                 │                │              │
       │                │── POST /api ───▶│                │              │
       │                │   /chat         │                │              │
       │                │                 │── POST /v1/ ──▶│              │
       │                │                 │   completions  │              │
       │                │                 │  (Bearer sk-…) │              │
       │                │                 │                │ decrypt in   │
       │                │                 │                │ TEE,          │
       │                │                 │                │ run model,    │
       │                │                 │                │ sign receipt  │
       │                │                 │◀── reply + ────│              │
       │                │                 │    receipt     │              │
       │                │◀── reply +──────│                │              │
       │                │    receipt      │                │              │
       │◀── render ─────│                 │                │              │
       │   reply        │                 │                │              │
       │                │── render ───────┼────────────────┼─────────────▶│
       │                │   receipt card  │                │              │
       ▼                ▼                 ▼                ▼              ▼
```

---

## Tech stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind v4, framer-motion |
| Inference | NEAR AI Cloud — `cloud-api.near.ai` |
| Models | GLM-4.6 FP8, DeepSeek V3.1, GPT-OSS 120B, Qwen3 30B A3B |
| Enclave | Intel TDX + Nvidia H100 Confidential Compute |
| Hosting | Vercel (planned) |

---

## Quick start

```bash
cd frontend
cp .env.example .env.local        # paste your NEAR_API_KEY
npm install
npm run dev                       # http://localhost:3000
```

The landing page renders without a key. The `/chat` workspace will require
`NEAR_API_KEY` once it's built.

---

## Project layout

```
near boom/
├── README.md                     ← this file
├── plan.md                       ← full MVP plan
├── near-ai-cloud-api.md          ← NEAR API reference
└── frontend/
    ├── package.json
    ├── .env.example
    └── app/
        ├── layout.tsx
        ├── page.tsx              ← landing
        ├── globals.css
        └── components/
            ├── Navbar.tsx
            └── ui/
                ├── reveal.tsx
                ├── animated-wave.tsx
                ├── metrics-section.tsx
                └── powered-by.tsx
```

---

## Why this matters

| Without TEE | With Confide on NEAR |
|---|---|
| Provider sees your raw code | Provider sees only ciphertext |
| You trust the SaaS log policy | You hold a signed receipt |
| Defense, finance, healthcare can't use AI coding tools | They can — verifiably |
| One vendor lock-in per model | One API, four frontier models |
| "Trust us" | "Verify us" |

---

## Status

- ✅ Landing page (dark theme, animated, full sections, mobile-responsive, NEAR branding)
- ✅ Confide logo + browser favicon
- ✅ `/chat` workspace UI (two-pane: chat + Scanner)
- ✅ `/api/chat` server route proxying to `cloud-api.near.ai/v1/chat/completions`
- ✅ Scanner panel renders real fields when NEAR returns them; graceful stub when key/credits absent
- ✅ Model picker wired to NEAR's real model IDs (Claude Opus 4.7, GLM 5.1, DeepSeek V3.1, GPT-OSS 120B, Qwen3 30B)
- ✅ Profitable pricing tiers based on NEAR's actual cost-per-million-token math
- ✅ Full NEAR AI Cloud docs captured in `md/` (quickstart, models, reasoning, private inference, gateway/TLS attestation, complete API endpoint reference)
- ✅ Hosted brand logos on `/models` for Anthropic, Google, DeepSeek, OpenAI/GPT, Qwen/Alibaba, GLM/Z.ai (Moonshot + Black Forest Labs still on letter-badge fallback)
- ✅ Silver/white MagicRings WebGL backdrop on the landing final CTA
- ✅ Live TEE attestation against a real response (previously blocked on NEAR account credits — confirmed working end-to-end as of 2026-08-25)
- ⏳ "Verify receipt" button that calls `/v1/attestation/report` per message
- ⏳ Local audit log (browser localStorage for receipt history)
- ⏳ Live model list (call `GET /v1/model/list` instead of hardcoded picker)

See [md/plan.md](./md/plan.md) for the full roadmap and [md/](./md) for the NEAR AI Cloud docs we've captured (quickstart, models, reasoning, private inference, gateway + TLS attestation, API endpoint reference).

---

## License

Private — © 2026 Ayush Singh. All rights reserved.
