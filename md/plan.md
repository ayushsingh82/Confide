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

## 10. Open Questions

- **Real attestation shape**: NEAR's exact response fields for TEE attestation aren't visible without an API key. Need to call `/v1/chat/completions` once with a real key to inspect headers/extra fields.
- **Naming**: `Confide` is placeholder. Real candidates: Sentinel, Vault, Hush, Cipher, Attest.
- **Audit storage**: Per-browser (localStorage) for MVP. Server-side audit DB is post-MVP.
- **Pricing display**: Two-tier marketing copy only, no real Stripe yet.

---

## 11. What's Already Saved

- `near-ai-cloud-api.md` — full API/auth/model/SLA reference compiled from NEAR docs + Scalar client.

---

## 12. Definition of Done (MVP)

- [ ] Landing page renders cleanly in dark theme, mobile + desktop.
- [ ] Chat workspace sends a prompt, gets a real reply from NEAR AI Cloud.
- [ ] Scanner panel shows non-faked attestation/model data per message.
- [ ] No API keys leak to the browser.
- [ ] `npm run build` passes with zero errors.
- [ ] Deployed to a Vercel preview URL.
