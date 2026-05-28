# NEAR AI Cloud — Complete API & Product Reference

> Compiled from the NEAR AI marketing site, docs.near.ai, and the Scalar OpenAPI client (v1.0.0, OpenAPI 3.1.0, MIT).
> The live OpenAPI spec at `https://cloud-api.near.ai/openapi.json` is auth-gated (HTTP 401); the Scalar client page is a JavaScript SPA and could not be statically fetched. Endpoint groups below are taken from the navigation tree shown in the docs.

---

## 1. Overview

NEAR AI Cloud enables enterprises, developers, and governments to run private, verifiable intelligence at scale. It unifies leading open-source models behind a single OpenAI-compatible endpoint.

- Every request runs inside hardware-enforced Trusted Execution Environments (TEEs).
- Generates cryptographic proof of integrity.
- Models, prompts, and data stay fully private — even from NEAR AI, model providers, and cloud providers.
- Backed by a distributed network of high-performance GPUs.

**Status:** Beta release.

---

## 2. Core Capabilities

| Pillar | Detail |
|---|---|
| Secure | Hardware-backed trust (TEEs), trustless system |
| Flexible | Switch models without code changes, OpenAI-compatible |
| Isolated | Hardware-isolated execution per request |
| Verifiable | Cryptographic proof of integrity |
| Agile | Fast deployment, prototype-to-prod in minutes |

---

## 3. Models & Pricing

| Model | Context | Input ($/M tokens) | Output ($/M tokens) | Notes |
|---|---|---|---|---|
| GLM-4.6 FP8 | 200K | $0.75 | $2.00 | Zhipu AI, 358B params, FP8 quantized |
| GPT OSS 120B | 131K | $0.20 | $0.60 | OpenAI open-weight, 117B MoE |
| DeepSeek V3.1 | 128K | $1.00 | $2.50 | Hybrid thinking/non-thinking modes |
| Qwen3 30B A3B Instruct 2507 | 262K | $0.15 | $0.45 | MoE, 30.5B total / 3.3B active |

Contact NEAR AI for pricing on custom models and enterprise deployment.

---

## 4. Performance & SLAs

| Category | Spec |
|---|---|
| Latency | 95% of requests <100ms |
| Throughput | 1,000+ req/sec per node, auto-scaling |
| Context impact | <5% latency at 200K tokens |
| Scale-out | <3 min (small), <5 min (large models) |
| Attestation verify | <30 seconds |
| Encryption | TLS 1.3 in transit, AES-256 at rest |
| Key rotation | HSM-backed, every 90 days |
| Uptime | 99.5% monthly (confidential enclaves) |
| Monitoring | Real-time + immutable audit logs |

---

## 5. Target Solutions

| Segment | Value Prop |
|---|---|
| Enterprise | Personal/proprietary/regulated data, exceeds global compliance |
| Developers | One API, prototype-to-prod in minutes, IP protection |
| Government | Sovereign AI, classified data control across borders |

---

## 6. Authentication

The API supports three authentication methods. All use the `Authorization: Bearer <token>` header.

| Method | Header Format | Use Case |
|---|---|---|
| Access Token (JWT) | `Authorization: Bearer <jwt_token>` | Most API endpoints. Obtained via `POST /users/me/access_tokens` |
| Refresh Token | `Authorization: Bearer rt_<token>` | Only for `POST /users/me/access_tokens` (obtained from OAuth login) |
| API Key | `Authorization: Bearer sk-<api_key>` | Programmatic access |

---

## 7. API Endpoints

### 7.1 Chat

| Method | Endpoint | Description |
|---|---|---|
| POST | `/v1/chat/completions` | Create chat completion (OpenAI-compatible) |
| GET  | `/v1/models` | List available models |

### 7.2 Models (Public Catalog)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/v1/model/list` | List models with pricing (paginated; `limit`, `offset`; in-process cache) |
| GET | `/v1/model/{model_name}` | Get pricing and metadata for a model. URL-encode names with `/` |

**`GET /v1/model/list` query params**
- `limit` (integer, nullable, default 100, non-negative) — max models to return
- `offset` (integer, nullable, default 0, non-negative) — models to skip

**Response 200 shape (`/v1/model/list`)**
```json
{
  "limit": 1,
  "offset": 1,
  "total": 1,
  "models": [
    {
      "modelId": "string",
      "inputCostPerToken":  { "amount": 1, "currency": "string", "scale": 1 },
      "outputCostPerToken": { "amount": 1, "currency": "string", "scale": 1 },
      "cacheReadCostPerToken": { "amount": 1, "currency": "string", "scale": 1 },
      "costPerImage": { "amount": 1, "currency": "string", "scale": 1 },
      "metadata": {
        "aliases": ["string"],
        "architecture": {
          "inputModalities":  ["string"],
          "outputModalities": ["string"]
        },
        "attestationSupported": true,
        "contextLength": 1,
        "huggingFaceId": null,
        "inferenceUrl": null,
        "maxOutputLength": null,
        "modelDescription": "string",
        "modelDisplayName": "string",
        "modelIcon": null,
        "ownedBy": "string",
        "providerConfig": null,
        "providerType": "string",
        "quantization": null,
        "supportedFeatures": ["string"],
        "supportedSamplingParameters": ["string"],
        "verifiable": true
      }
    }
  ]
}
```

**Status codes**
- 200 — list of models with pricing
- 400 — invalid pagination parameters
- 404 — model not found (single-model endpoint)
- 500 — server error

### 7.3 Conversations

| Method | Endpoint | Description |
|---|---|---|
| POST   | `/v1/conversations` | Create conversation |
| GET    | `/v1/conversations/{conversation_id}` | Get conversation |
| POST   | `/v1/conversations/{conversation_id}` | Update conversation |
| DELETE | `/v1/conversations/{conversation_id}` | Delete conversation |
| GET    | `/v1/conversations/{conversation_id}/items` | List conversation items |
| POST   | `/v1/conversations/{conversation_id}/items` | Add items to conversation |
| POST   | `/conversations/{conversation_id}/archive` | Archive conversation |
| DELETE | `/conversations/{conversation_id}/archive` | Unarchive conversation |
| POST   | `/conversations/{conversation_id}/clone`   | Clone conversation |
| POST   | `/conversations/{conversation_id}/pin`     | Pin conversation |
| DELETE | `/conversations/{conversation_id}/pin`     | Unpin conversation |

### 7.4 Other Endpoint Groups

These groups appear in the Scalar navigation but the individual operations were collapsed in the source page. Each group corresponds to a section of the OpenAPI document.

| Group | Purpose |
|---|---|
| Images | Image generation / processing |
| Audio | Audio inference (likely transcription / TTS) |
| Rerank | Result reranking |
| Score | Scoring operations |
| Privacy | Privacy controls |
| Responses | Response management (OpenAI Responses API analog) |
| Organizations | Organization administration |
| Organization Members | Member management |
| Workspaces | Workspace management |
| Files | File operations |
| Users | User management |
| Invitations | Invite management |
| Usage | Usage tracking |
| Billing | Billing operations |
| Health | Health checks |
| Attestation | TEE attestation |
| Gateway | Gateway controls |
| Admin | Admin operations |
| Services | Service management |
| Feature Requests | Feature requests |

---

## 8. Request Example (Node.js undici)

```js
import { request } from 'undici'

const { statusCode, body } = await request(
  '/v1/model/list?limit=null&offset=null',
  {
    headers: {
      Authorization: 'Bearer YOUR_SECRET_TOKEN'
    }
  }
)
```

---

## 9. Docs Structure

| Section | Subsections |
|---|---|
| Getting Started | Introduction, Quickstart |
| Models | Available Models, Reasoning Models Config |
| Private Inference | Architecture / data protection |
| Verification | Model, Gateway, TLS Attestation, Chat Verification |
| Guides | OpenAI Client, E2EE Chat |
| API Reference | Full OpenAPI spec (v1.0.0, OpenAPI 3.1.0, MIT) |

---

## 10. Other Products

| Product | Status |
|---|---|
| NEAR AI Cloud | Beta |
| OpenClaw (always-on AI agent) | Private beta on NEAR AI Cloud |
| Agents | Available |

---

## 11. Company & Links

| Resource | Notes |
|---|---|
| Owner | Jasnah Inc., DBA NEAR AI |
| Copyright | © 2026 |
| Community | Telegram, X |
| Developer Dashboard | available |
| Code | GitHub |
| Legal | Terms, Privacy Policy, NEAR AI Services ToS, Acceptable Use Policy, Cookie Policy |

---

## 12. Notes on Completeness

- **Chat**, **Models**, and **Conversations** endpoint lists are complete from the source page.
- All other groups (Images, Audio, Rerank, …) had their operations collapsed in the Scalar UI; only group names are recorded. To enumerate every operation, fetch the live OpenAPI spec while authenticated (e.g. `curl -H "Authorization: Bearer sk-..." https://cloud-api.near.ai/openapi.json`).
