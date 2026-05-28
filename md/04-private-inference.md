# Private Inference

When you use traditional AI services, your data passes through systems controlled by cloud providers and AI companies. Your prompts, the AI's responses, and even the processing of your requests are all visible to these third parties. This creates serious security concerns for sensitive applications.

Private inference solves this problem. It ensures that AI computations happen in a completely isolated environment where no one — not the cloud provider, not the model provider, not even NEAR AI — can access your data. At the same time, you can independently verify that your requests were actually processed in this secure environment through cryptographic attestation.

## What Is Private Inference?

Both your input data and the model's outputs remain completely hidden from everyone except the user and client even while the computation happens on remote servers you don't control. Hardware-based security makes it technically impossible to see your data, even with physical access to the servers.

Three core guarantees:

- **Complete Privacy** — Your prompts, model weights, and outputs are encrypted and isolated in hardware-secured environments. Infrastructure providers, model providers, and NEAR cannot access your data at any point.
- **Cryptographic Verification** — Every computation generates cryptographic proof it occurred inside a genuine, secure TEE. You can independently verify the secure execution environment without trusting any third party.
- **Production Performance** — Hardware-accelerated TEEs with NVIDIA Confidential Computing deliver high-throughput inference with minimal latency overhead.

## How It Works — Trusted Execution Environment (TEE)

NEAR AI Cloud combines Intel TDX and NVIDIA TEE technologies:

- **Intel TDX (Trust Domain Extensions)** — Creates confidential virtual machines (CVMs) that isolate AI workloads from the host, preventing unauthorized access to data in memory.
- **NVIDIA TEE** — Provides GPU-level isolation for model inference, ensuring model weights and computations remain completely private.
- **Cryptographic Attestation** — Each TEE generates cryptographic proofs of its integrity and configuration for independent verification.

## Client-Side Encryption

If you're using a standard OpenAI SDK or curl, your prompts are automatically protected by TLS encryption — no additional setup required.

NEAR AI Cloud supports two connection modes. Both terminate TLS **inside a TEE**:

- **Gateway mode** — Routes through `cloud-api.near.ai`, which runs in its own TEE before forwarding to the model TEE.
- **Direct completions mode** — Connects you straight to the model's TEE — one hop, one TEE to verify.

Key insight: TLS terminates inside the TEE (not at an external load balancer). Your prompts remain encrypted until they reach the secure enclave.

Why this works:

- **Standard HTTPS = TLS encryption** — Applied automatically by your client before any data leaves your machine.
- **TLS terminates inside the TEE** — Unlike traditional cloud services where TLS terminates at an external load balancer, NEAR AI Cloud terminates inside the TEE. Encrypted data travels from your laptop directly into the secure enclave before decryption.
- **No plaintext exposure** — Because TLS terminates within the TEE, prompts are never exposed in plaintext outside the hardware-secured environment.

## Direct Completions

Each model is available at its own subdomain. Your request goes straight to the model's TEE — no gateway hop.

Base URL format:

```
https://{slug}.completions.near.ai/v1
```

Available endpoints (see `completions.near.ai/endpoints` for the full live list):

| Subdomain | Model | Input | Output |
|---|---|---|---|
| `qwen35-122b.completions.near.ai` | Qwen3.5-122B | Text | Text |
| `deepseek-v31.completions.near.ai` | DeepSeek-V3.1 | Text | Text |
| `qwen3-30b.completions.near.ai` | Qwen3-30B | Text | Text |
| `gpt-oss-120b.completions.near.ai` | GPT-OSS-120B | Text | Text |
| `glm-5.completions.near.ai` | GLM-5 | Text | Text |
| `qwen3-vl-30b.completions.near.ai` | Qwen3-VL-30B | Text, Image | Text |
| `flux2-klein.completions.near.ai` | FLUX.2-klein-4B | Text | Image |
| `whisper-large-v3.completions.near.ai` | Whisper Large V3 | Audio | Text |
| `qwen3-embedding.completions.near.ai` | Qwen3-Embedding-0.6B | Text | Embedding |
| `qwen3-reranker.completions.near.ai` | Qwen3-Reranker-0.6B | Text | Score |

Each subdomain exposes the same OpenAI-compatible API as the gateway, plus model-specific endpoints:

- `POST /v1/chat/completions` — Chat completions (with signing)
- `POST /v1/completions` — Text completions
- `POST /v1/embeddings` — Embeddings
- `POST /v1/images/generations` — Image generation
- `POST /v1/audio/transcriptions` — Audio transcription
- `POST /v1/rerank` — Reranking
- `GET /v1/models` — Available models
- `GET /v1/attestation/report` — TEE attestation (TDX + GPU)
- `GET /v1/signature/{chat_id}` — Retrieve cached signatures

Benefits of direct completions:

- **Fewer hops** — Reduces latency
- **Simpler trust model** — Only the model TEE needs to be verified (no gateway verification required)
- **TLS binds to attestation** — `include_tls_fingerprint=true` on the attestation endpoint binds the TLS certificate to the attestation report

## The Inference Process

### Via Gateway (`cloud-api.near.ai`)

1. **Request initiation** — Send via HTTPS to the LLM Gateway. TLS terminates inside the TEE.
2. **Secure routing** — Gateway routes to the appropriate Private LLM Node based on model, availability, and load.
3. **Secure inference** — Inference executes inside the Private LLM Node's TEE.
4. **Attestation generation** — TEE generates CPU and GPU attestation reports.
5. **Cryptographic signing** — TEE signs both your original request and the inference results.
6. **Verifiable response** — You receive the AI response along with cryptographic signatures and attestation data.

### Via Direct Completions (`{slug}.completions.near.ai`)

1. **Direct request** — HTTPS directly to the model's subdomain. TLS terminates inside the model's TEE — no intermediate gateway.
2. **Secure inference** — Model processes entirely within its TEE.
3. **Attestation & signing** — TEE generates attestation reports and signs request + results.
4. **Verifiable response** — Response includes cryptographic signatures. Only model verification is needed.

## Architecture Overview

### Private LLM Nodes

Each node provides secure, isolated AI inference:

- **Standardized hardware** — 8× NVIDIA H200 GPUs per node
- **Intel TDX-enabled CPUs** — Hardware-enforced isolation via secure virtualization
- **Private-ML-SDK** — Manages secure model execution, attestation generation, cryptographic signing
- **Health monitoring** — Automated liveness checks

### LLM Gateway

Central orchestration layer:

- **Model management** — Registers and manages models across the Private LLM Node network
- **Request routing** — Intelligently routes to nodes based on availability and load
- **Attestation verification** — Validates and stores TEE attestation reports
- **Access control** — API keys, authentication, usage tracking for billing

## Security Guarantees

### Defense in Depth

- **Hardware-level isolation** — Enforced at the hardware level; prevents access even from privileged admins or cloud providers.
- **Secure communication** — TLS encryption; termination inside the TEE.
- **Cryptographic attestation** — Verifies the integrity of the execution environment.
- **Result authentication** — All outputs cryptographically signed inside the TEE before leaving.

### Threat Protection

- **Malicious infrastructure providers** — Hardware-enforced TEE isolation prevents cloud providers accessing prompts, weights, or results — even with physical access.
- **Network-based attacks** — End-to-end encryption prevents MITM and eavesdropping.
- **Model extraction attempts** — Weights remain encrypted/isolated within the TEE.
- **Result tampering** — Signatures generated inside the TEE ensure responses cannot be modified in transit without detection.
