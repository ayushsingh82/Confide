# NEAR AI Cloud API — Endpoint Reference

A comprehensive cloud API for AI model inference, conversation management, and organization administration.

- **Base URL (Gateway):** `https://cloud-api.near.ai`
- **OpenAPI version:** 3.1.0 · API version 1.0.0 · License MIT
- **Owner:** NEAR AI Team

## Authentication

Three methods, all sent as `Authorization: Bearer <token>`:

| Method | Format | Use case |
|---|---|---|
| Access Token (JWT) | `Bearer <jwt_token>` | Most API endpoints. Obtain by calling `POST /users/me/access_tokens` with a refresh token. |
| Refresh Token | `Bearer rt_<refresh_token>` | Only with `POST /users/me/access_tokens` to mint new JWTs. Obtained from OAuth login. |
| API Key | `Bearer sk-<api_key>` | Programmatic access. |

---

## Chat

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/v1/chat/completions` | Required | Create chat completion (OpenAI-compatible). Supports streaming and non-streaming. |
| GET | `/v1/models` | Optional | List models available for completions (OpenAI-compatible). |

### `POST /v1/chat/completions`

**Body (`ChatCompletionRequest`)** — `application/json`

| Field | Type | Required |
|---|---|---|
| `messages` | `Message[]` | yes |
| `model` | `string` | yes |
| `frequency_penalty` | `number\|null` (float) | no |
| `max_tokens` | `integer\|null` (int64) | no |
| `n` | `integer\|null` (int64) | no |
| `presence_penalty` | `number\|null` (float) | no |
| `stop` | `string[]` | no |
| `stream` | `boolean\|null` | no |
| `temperature` | `number\|null` (float) | no |
| `top_p` | `number\|null` (float) | no |

**Response 200**

```json
{
  "id": "string",
  "object": "string",
  "created": 1,
  "model": "string",
  "choices": [
    {
      "index": 1,
      "finish_reason": null,
      "message": {
        "role": "string",
        "content": "string",
        "name": null,
        "tool_call_id": null,
        "tool_calls": [
          {
            "id": "string",
            "type": "string",
            "thought_signature": null,
            "function": { "name": "string", "arguments": "string" }
          }
        ]
      }
    }
  ],
  "usage": {
    "prompt_tokens": 1,
    "completion_tokens": 1,
    "total_tokens": 1,
    "prompt_tokens_details": { "cached_tokens": 1 },
    "completion_tokens_details": { "reasoning_tokens": 1 }
  }
}
```

**Status codes:** 200 success · 400 invalid params · 401 invalid/missing key · 402 insufficient credits · 500 server error · 529 all backends overloaded (retry with exponential backoff).

### `GET /v1/models`

**Response 200**

```json
{
  "object": "string",
  "data": [
    {
      "id": "string",
      "name": null,
      "object": "string",
      "owned_by": "string",
      "created": 1,
      "description": null,
      "context_length": null,
      "max_output_length": null,
      "hugging_face_id": null,
      "quantization": null,
      "input_modalities": ["string"],
      "output_modalities": ["string"],
      "architecture": {
        "inputModalities": ["string"],
        "outputModalities": ["string"]
      },
      "pricing": {
        "input": 1,
        "output": 1,
        "completion": "string",
        "prompt": "string",
        "image": "string",
        "input_cache_read": "string",
        "request": "string"
      },
      "supported_features": ["string"],
      "supported_sampling_parameters": ["string"]
    }
  ]
}
```

---

## Images

| Method | Path | Description |
|---|---|---|
| POST | `/v1/images/edits` | Edit images |
| POST | `/v1/images/generations` | Generate images |

## Audio

| Method | Path | Description |
|---|---|---|
| POST | `/v1/audio/transcriptions` | Audio → text transcription |

## Rerank

| Method | Path | Description |
|---|---|---|
| POST | `/v1/rerank` | Document reranking |

## Score

| Method | Path | Description |
|---|---|---|
| POST | `/v1/score` | Text similarity scoring |

## Privacy

| Method | Path | Description |
|---|---|---|
| POST | `/v1/privacy/classify` | PII span classification |
| POST | `/v1/privacy/redact` | PII redaction |

## Models (catalog)

Public model catalog and information.

| Method | Path | Description |
|---|---|---|
| GET | `/v1/model/list` | List models with pricing (paginated, in-process cached) |
| GET | `/v1/model/{model_name}` | Get pricing + metadata for one model. URL-encode names containing `/`. |

---

## Conversations

| Method | Path | Description |
|---|---|---|
| POST | `/v1/conversations` | Create conversation |
| GET | `/v1/conversations/{conversation_id}` | Get conversation |
| POST | `/v1/conversations/{conversation_id}` | Update conversation |
| DELETE | `/v1/conversations/{conversation_id}` | Delete conversation |
| GET | `/v1/conversations/{conversation_id}/items` | List conversation items |
| POST | `/v1/conversations/{conversation_id}/items` | Add items to conversation |
| POST | `/conversations/{conversation_id}/archive` | Archive |
| DELETE | `/conversations/{conversation_id}/archive` | Unarchive |
| POST | `/conversations/{conversation_id}/clone` | Clone |
| POST | `/conversations/{conversation_id}/pin` | Pin |
| DELETE | `/conversations/{conversation_id}/pin` | Unpin |

## Responses

Response handling and streaming.

| Method | Path | Description |
|---|---|---|
| POST | `/v1/responses` | Create response |
| GET | `/v1/responses/{response_id}` | Get response |
| DELETE | `/v1/responses/{response_id}` | Delete response |
| POST | `/v1/responses/{response_id}/cancel` | Cancel response |
| GET | `/v1/responses/{response_id}/input_items` | List input items |

---

## Organizations

| Method | Path | Description |
|---|---|---|
| GET | `/v1/organizations` | List orgs |
| POST | `/v1/organizations` | Create org |
| GET | `/v1/organizations/{org_id}` | Get org |
| PUT | `/v1/organizations/{org_id}` | Update org |
| DELETE | `/v1/organizations/{org_id}` | Delete org |

## Organization Members

| Method | Path | Description |
|---|---|---|
| GET | `/v1/organizations/{org_id}/members` | List members |
| POST | `/v1/organizations/{org_id}/members` | Add member |
| POST | `/v1/organizations/{org_id}/members/invite-by-email` | Email invite |
| PUT | `/v1/organizations/{org_id}/members/{user_id}` | Update member |
| DELETE | `/v1/organizations/{org_id}/members/{user_id}` | Remove member |

## Workspaces

Workspace and API key management.

| Method | Path | Description |
|---|---|---|
| GET | `/v1/organizations/{org_id}/workspaces` | List workspaces in org |
| POST | `/v1/organizations/{org_id}/workspaces` | Create workspace |
| GET | `/v1/workspaces/{workspace_id}` | Get workspace |
| PUT | `/v1/workspaces/{workspace_id}` | Update workspace |
| DELETE | `/v1/workspaces/{workspace_id}` | Delete workspace |
| GET | `/v1/workspaces/{workspace_id}/api-keys` | List API keys |
| POST | `/v1/workspaces/{workspace_id}/api-keys` | Create API key |
| DELETE | `/v1/workspaces/{workspace_id}/api-keys/{key_id}` | Revoke API key |
| PATCH | `/v1/workspaces/{workspace_id}/api-keys/{key_id}` | Update API key |
| PATCH | `/v1/workspaces/{workspace_id}/api-keys/{key_id}/spend-limit` | Set spend limit |

## Files

| Method | Path | Description |
|---|---|---|
| GET | `/v1/files` | List files |
| POST | `/v1/files` | Upload file |
| GET | `/v1/files/{file_id}` | Get file metadata |
| DELETE | `/v1/files/{file_id}` | Delete file |
| GET | `/v1/files/{file_id}/content` | Download file content |

## Users

| Method | Path | Description |
|---|---|---|
| GET | `/v1/users/me` | Get my profile |
| PATCH | `/v1/users/me` | Update my profile |
| POST | `/v1/users/me/access-tokens` | Create JWT access token (with refresh token) |
| GET | `/v1/users/me/invitations` | List my invitations |
| POST | `/v1/users/me/invitations/{invitation_id}/accept` | Accept invitation |
| POST | `/v1/users/me/invitations/{invitation_id}/decline` | Decline invitation |
| GET | `/v1/users/me/refresh-tokens` | List refresh tokens |
| DELETE | `/v1/users/me/refresh-tokens/{refresh_token_id}` | Revoke refresh token |
| DELETE | `/v1/users/me/tokens` | Revoke all my tokens |

## Invitations

Token-based invitation handling.

| Method | Path | Description |
|---|---|---|
| GET | `/v1/invitations/{token}` | Look up invitation by token |
| POST | `/v1/invitations/{token}/accept` | Accept via token |

## Usage

Usage tracking and billing information.

| Method | Path | Description |
|---|---|---|
| GET | `/v1/organizations/{org_id}/usage/balance` | Current credit balance |
| GET | `/v1/organizations/{org_id}/usage/history` | Usage history |
| GET | `/v1/organizations/{org_id}/usage/metrics` | Aggregate usage metrics |
| GET | `/v1/organizations/{org_id}/usage/timeseries` | Usage timeseries |
| POST | `/v1/usage` | Report usage |
| GET | `/v1/workspaces/{workspace_id}/api-keys/{api_key_id}/usage/history` | Per-key usage history |

## Billing

| Method | Path | Description |
|---|---|---|
| POST | `/v1/billing/costs` | Billing costs (HuggingFace integration) |

## Health

| Method | Path | Description |
|---|---|---|
| GET | `/v1/health` | Service liveness |

---

## Attestation

Attestation and verification endpoints.

| Method | Path | Description |
|---|---|---|
| GET | `/v1/attestation/report` | TEE attestation report (TDX + GPU). Query: `signing_algo`, `nonce`, `include_tls_fingerprint`. |
| GET | `/v1/signature/{chat_id}` | Retrieve cached signature for a past chat |

## Gateway

| Method | Path | Description |
|---|---|---|
| POST | `/v1/check_api_key` | Validate an API key (internal model-gateway integration) |

---

## Admin

Administrative endpoints (admin access required).

| Method | Path | Description |
|---|---|---|
| GET | `/v1/admin/access-tokens` | List admin access tokens |
| POST | `/v1/admin/access-tokens` | Create admin access token |
| DELETE | `/v1/admin/access-tokens/{token_id}` | Revoke admin access token |
| GET | `/v1/admin/models` | List models (admin) |
| PATCH | `/v1/admin/models` | Patch model entries |
| POST | `/v1/admin/models/deprecate` | Deprecate a model |
| DELETE | `/v1/admin/models/{model_name}` | Delete model |
| GET | `/v1/admin/models/{model_name}/history` | Model change history |
| GET | `/v1/admin/organizations/{org_id}/concurrent-limit` | Concurrent request limit |
| PATCH | `/v1/admin/organizations/{org_id}/concurrent-limit` | Set concurrent limit |
| PATCH | `/v1/admin/organizations/{org_id}/limits` | Set org limits |
| GET | `/v1/admin/organizations/{org_id}/limits/history` | Limits history |
| GET | `/v1/admin/organizations/{org_id}/metrics` | Org metrics |
| GET | `/v1/admin/organizations/{org_id}/metrics/timeseries` | Org metrics timeseries |
| GET | `/v1/admin/platform/metrics` | Platform-level metrics |
| POST | `/v1/admin/services` | Register service |
| PATCH | `/v1/admin/services/{id}` | Update service |
| GET | `/v1/admin/users` | List users |

## Services

Public platform services (e.g. web_search pricing).

| Method | Path | Description |
|---|---|---|
| GET | `/v1/services` | List services |
| GET | `/v1/services/{service_name}` | Get service |

## Feature Requests

| Method | Path | Description |
|---|---|---|
| GET | `/v1/admin/feature-requests` | List feature requests (admin) |
| POST | `/v1/feature-requests` | Submit a feature request |

---

## Quick `curl` Examples

### Chat completion via gateway

```bash
curl https://cloud-api.near.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-YOUR_KEY" \
  -d '{
    "model": "deepseek-ai/DeepSeek-V3.1",
    "messages": [{"role":"user","content":"Hello"}]
  }'
```

### Gateway attestation report (with TLS binding)

```bash
NONCE=$(openssl rand -hex 32)
curl "https://cloud-api.near.ai/v1/attestation/report?signing_algo=ecdsa&nonce=${NONCE}&include_tls_fingerprint=true" \
  -H 'accept: application/json'
```

### Model catalog (public)

```bash
curl "https://cloud-api.near.ai/v1/model/list?limit=50&offset=0" \
  -H "Authorization: Bearer sk-YOUR_KEY"
```
