# Available Models

NEAR AI Cloud provides access to leading AI models, each optimized for different use cases ranging from advanced reasoning and tool calling to long-context processing and multilingual tasks. All models run in secure TEE environments with transparent, pay-per-use pricing.

## Quick Reference

| Model | Model ID | Context | Input $/M | Output $/M |
|---|---|---|---|---|
| Claude Haiku 4.5 | `anthropic/claude-haiku-4-5` | 200K | $1.00 | $5.00 |
| Claude Opus 4.6 | `anthropic/claude-opus-4-6` | 200K | $5.00 | $25.00 |
| Claude Opus 4.7 | `anthropic/claude-opus-4-7` | 1000K | $5.00 | $25.00 |
| Claude Sonnet 4.5 | `anthropic/claude-sonnet-4-5` | 200K | $3.00 | $15.50 |
| Claude Sonnet 4.6 | `anthropic/claude-sonnet-4-6` | 1000K | $3.00 | $15.00 |
| FLUX.2-klein-4B | `black-forest-labs/FLUX.2-klein-4B` | 128K | $1.00 | $1.00 |
| Gemini 2.5 Flash | `google/gemini-2.5-flash` | 1000K | $0.30 | $2.50 |
| Gemini 2.5 Flash Lite | `google/gemini-2.5-flash-lite` | 1049K | $0.10 | $0.40 |
| Gemini 2.5 Pro | `google/gemini-2.5-pro` | 1000K | $1.25 | $10.00 |
| Gemini 3.1 Flash Lite | `google/gemini-3.1-flash-lite` | 1049K | $0.25 | $1.50 |
| Gemini 3.5 Flash | `google/gemini-3.5-flash` | 1000K | $1.50 | $9.00 |
| Gemini 3 Pro Preview | `google/gemini-3-pro` | 1000K | $1.25 | $15.00 |
| Gemma 4 31B Instruct | `google/gemma-4-31B-it` | 262K | $0.13 | $0.40 |
| Kimi K2.6 | `moonshotai/kimi-k2.6` | 262K | $0.80 | $3.50 |
| OpenAI GPT-4.1 | `openai/gpt-4.1` | 1000K | $2.00 | $8.00 |
| OpenAI GPT-4.1 Mini | `openai/gpt-4.1-mini` | 1000K | $0.40 | $1.60 |
| OpenAI GPT-4.1 Nano | `openai/gpt-4.1-nano` | 1000K | $0.10 | $0.40 |
| OpenAI GPT-5 | `openai/gpt-5` | 400K | $1.25 | $10.00 |
| GPT-5.1 | `openai/gpt-5.1` | 400K | $1.25 | $10.00 |
| OpenAI GPT-5.2 | `openai/gpt-5.2` | 400K | $1.80 | $15.50 |
| GPT-5.4 | `openai/gpt-5.4` | 1050K | $2.50 | $15.00 |
| GPT-5.4 Mini | `openai/gpt-5.4-mini` | 400K | $0.75 | $4.50 |
| GPT-5.4 Nano | `openai/gpt-5.4-nano` | 400K | $0.20 | $1.25 |
| GPT-5.5 | `openai/gpt-5.5` | 1050K | $5.00 | $30.00 |
| GPT-5 Mini | `openai/gpt-5-mini` | 400K | $0.25 | $2.00 |
| GPT-5 Nano | `openai/gpt-5-nano` | 400K | $0.05 | $0.40 |
| GPT OSS 120B | `openai/gpt-oss-120b` | 131K | $0.15 | $0.55 |
| OpenAI o3 | `openai/o3` | 200K | $2.00 | $8.00 |
| o3 Mini | `openai/o3-mini` | 200K | $1.10 | $4.40 |
| OpenAI o4 Mini | `openai/o4-mini` | 200K | $1.10 | $4.40 |
| Privacy Filter | `openai/privacy-filter` | 512 | $0.01 | $0.00 |
| Whisper Large v3 | `openai/whisper-large-v3` | 448 | $0.01 | $0.01 |
| Qwen3 30B A3B Instruct 2507 | `Qwen/Qwen3-30B-A3B-Instruct-2507` | 262K | $0.15 | $0.55 |
| Qwen3.5 122B A10B | `Qwen/Qwen3.5-122B-A10B` | 131K | $0.40 | $3.20 |
| Qwen 3.6 35B A3B FP8 | `Qwen/Qwen3.6-35B-A3B-FP8` | 262K | $0.17 | $1.10 |
| Qwen3.7 Max | `qwen/qwen3.7-max` | 1000K | $2.80 | $7.50 |
| Qwen3-Embedding-0.6B | `Qwen/Qwen3-Embedding-0.6B` | 41K | $0.01 | $0.01 |
| Qwen3-Reranker-0.6B | `Qwen/Qwen3-Reranker-0.6B` | 41K | $0.01 | $0.01 |
| Qwen3-VL-30B-A3B-Instruct | `Qwen/Qwen3-VL-30B-A3B-Instruct` | 256K | $0.15 | $0.55 |
| GLM 5.1 | `zai-org/GLM-5.1-FP8` | 203K | $0.85 | $3.30 |

## Model Details

### Claude Haiku 4.5

Anthropic's fastest model with near-frontier intelligence. Extended thinking support with 200K context window. Best for high-throughput, cost-sensitive workloads.

- 200K context, $1.00/M input, $5.00/M output
- Model ID: `anthropic/claude-haiku-4-5`

### Claude Opus 4.6

Anthropic's most intelligent model for building agents and coding.

- 200K context, $5.00/M input, $25.00/M output
- Model ID: `anthropic/claude-opus-4-6`

### Claude Opus 4.7

Anthropic's most capable model. Next-generation built for long-running agents and complex coding tasks. 1M token context window with 128K max output.

- 1000K context, $5.00/M input, $25.00/M output
- Model ID: `anthropic/claude-opus-4-7`

### Claude Sonnet 4.5

A powerful, efficient model balancing intelligence and speed. Excels at complex reasoning, coding, and creative tasks with 200K context window. Anonymized, not TEE-protected.

- 200K context, $3.00/M input, $15.50/M output
- Model ID: `anthropic/claude-sonnet-4-5`

### Claude Sonnet 4.6

Anthropic's best balance of speed and intelligence. Extended thinking support with 1M token context window and 64K max output. Ideal for most production workloads.

- 1000K context, $3.00/M input, $15.00/M output
- Model ID: `anthropic/claude-sonnet-4-6`

### FLUX.2-klein-4B

The FLUX.2 [klein] model family are the fastest image models to date. Unifies generation and editing in a single compact architecture, delivering state-of-the-art quality with end-to-end inference in as low as under a second.

- 128K context, $1.00/M input, $1.00/M output
- Model ID: `black-forest-labs/FLUX.2-klein-4B`

### Gemini 2.5 Flash

Google's fast hybrid reasoning model with 1M token context window. Optimized for speed and cost while maintaining strong performance across tasks.

- 1000K context, $0.30/M input, $2.50/M output
- Model ID: `google/gemini-2.5-flash`

### Gemini 2.5 Flash Lite

A lightweight reasoning model in the Gemini 2.5 family, optimized for ultra-low latency and cost efficiency.

- 1049K context, $0.10/M input, $0.40/M output
- Model ID: `google/gemini-2.5-flash-lite`

### Gemini 2.5 Pro

Google's strongest reasoning model. Excels at coding, math, and complex analysis with 1M token context window. Supports text and image input.

- 1000K context, $1.25/M input, $10.00/M output
- Model ID: `google/gemini-2.5-pro`

### Gemini 3.1 Flash Lite

Google's GA high-efficiency multimodal model optimized for low-latency, high-volume workloads. Supports text, image, video, audio, and PDF inputs.

- 1049K context, $0.25/M input, $1.50/M output
- Model ID: `google/gemini-3.1-flash-lite`

### Gemini 3.5 Flash

Google's high-efficiency multimodal model with 1M token context. Strong agentic and coding performance.

- 1000K context, $1.50/M input, $9.00/M output
- Model ID: `google/gemini-3.5-flash`

### Gemini 3 Pro Preview

Highly capable multimodal model with an industry-leading 1M token context window. Optimized for complex reasoning, code generation, and long document analysis. Anonymized, not TEE-protected.

- 1000K context, $1.25/M input, $15.00/M output
- Model ID: `google/gemini-3-pro`

### Gemma 4 31B Instruct

Google's open-weight 31B-parameter language model, tuned for instruction following and dialogue. Strong general-purpose performance.

- 262K context, $0.13/M input, $0.40/M output
- Model ID: `google/gemma-4-31B-it`

### Kimi K2.6

Moonshot AI's frontier MoE model with 256K context window. Excels at complex reasoning, math, coding, and multilingual tasks with native vision support.

- 262K context, $0.80/M input, $3.50/M output
- Model ID: `moonshotai/kimi-k2.6`

### OpenAI GPT-4.1

OpenAI's flagship production model with 1M token context window. Excels at instruction following, coding, and long-context tasks. 75% cheaper cached input reads.

- 1000K context, $2.00/M input, $8.00/M output
- Model ID: `openai/gpt-4.1`

### OpenAI GPT-4.1 Mini

Cost-effective version of GPT-4.1 with the same 1M token context window.

- 1000K context, $0.40/M input, $1.60/M output
- Model ID: `openai/gpt-4.1-mini`

### OpenAI GPT-4.1 Nano

OpenAI's most cost-efficient model with 1M token context. Ideal for classification, extraction, and high-volume tasks.

- 1000K context, $0.10/M input, $0.40/M output
- Model ID: `openai/gpt-4.1-nano`

### OpenAI GPT-5

OpenAI's next-generation model with enhanced reasoning and 400K context window. Strong performance across coding, math, and creative tasks.

- 400K context, $1.25/M input, $10.00/M output
- Model ID: `openai/gpt-5`

### GPT-5.1

Latest frontier-grade model in the GPT-5 series. Stronger general-purpose reasoning, improved instruction adherence, more natural conversational style.

- 400K context, $1.25/M input, $10.00/M output
- Model ID: `openai/gpt-5.1`

### OpenAI GPT-5.2

400K context window. Anonymized endpoint optimized for deep reasoning and large-context workflows.

- 400K context, $1.80/M input, $15.50/M output
- Model ID: `openai/gpt-5.2`

### GPT-5.4

OpenAI's latest frontier model, unifying the Codex and GPT lines into a single system. 1M+ token context window (922K input, 128K output).

- 1050K context, $2.50/M input, $15.00/M output
- Model ID: `openai/gpt-5.4`

### GPT-5.4 Mini

Core capabilities of GPT-5.4 in a faster, more efficient model optimized for high-throughput workloads. Supports text and image inputs.

- 400K context, $0.75/M input, $4.50/M output
- Model ID: `openai/gpt-5.4-mini`

### GPT-5.4 Nano

Most lightweight and cost-efficient variant of the GPT-5.4 family. Optimized for speed-critical and high-volume tasks.

- 400K context, $0.20/M input, $1.25/M output
- Model ID: `openai/gpt-5.4-nano`

### GPT-5.5

OpenAI's frontier model designed for complex professional workloads. Stronger reasoning, higher reliability, improved token efficiency on hard tasks.

- 1050K context, $5.00/M input, $30.00/M output
- Model ID: `openai/gpt-5.5`

### GPT-5 Mini

Compact version of GPT-5, designed to handle lighter-weight reasoning tasks.

- 400K context, $0.25/M input, $2.00/M output
- Model ID: `openai/gpt-5-mini`

### GPT-5 Nano

Smallest and fastest variant in the GPT-5 system, optimized for developer tools, rapid interactions, and ultra-low latency environments.

- 400K context, $0.05/M input, $0.40/M output
- Model ID: `openai/gpt-5-nano`

### GPT OSS 120B

Open-weight, 117B-parameter Mixture-of-Experts (MoE) language model from OpenAI designed for high-reasoning, agentic, and general-purpose production use cases. Activates 5.1B parameters per forward pass; optimized to run on a single H100 GPU with native MXFP4 quantization. Supports configurable reasoning depth, full chain-of-thought access, and native tool use.

- 131K context, $0.15/M input, $0.55/M output
- Model ID: `openai/gpt-oss-120b`

### OpenAI o3

OpenAI's flagship reasoning model. Uses chain-of-thought to solve complex math, coding, and logic problems.

- 200K context, $2.00/M input, $8.00/M output
- Model ID: `openai/o3`

### o3 Mini

Cost-efficient language model optimized for STEM reasoning. Supports the `reasoning_effort` parameter.

- 200K context, $1.10/M input, $4.40/M output
- Model ID: `openai/o3-mini`

### OpenAI o4 Mini

Cost-effective reasoning model. Strong performance on math, coding, and scientific reasoning at a fraction of o3's cost.

- 200K context, $1.10/M input, $4.40/M output
- Model ID: `openai/o4-mini`

### Privacy Filter

PII detection (token classification) — returns spans for emails, phones, addresses, names, account numbers, secrets. NEAR AI runs this model in a TEE; prompts are not anonymized by the model itself, the cloud-api wraps it to do redaction.

- 512 context, $0.01/M input, $0.00/M output
- Model ID: `openai/privacy-filter`

### Whisper Large v3

State-of-the-art model for automatic speech recognition (ASR) and speech translation.

- 448 context, $0.01/M input, $0.01/M output
- Model ID: `openai/whisper-large-v3`

### Qwen3 30B A3B Instruct 2507

Mixture-of-experts (MoE) causal language model with 30.5B total parameters and 3.3B activated per inference. Ultra-long context up to 262K tokens; non-thinking mode only. Strong on instruction following, reasoning, logic, math, coding, multilingual.

- 262K context, $0.15/M input, $0.55/M output
- Model ID: `Qwen/Qwen3-30B-A3B-Instruct-2507`

### Qwen3.5 122B A10B

Qwen3.5 122B MoE model with 10B active parameters, supporting reasoning and tool calling.

- 131K context, $0.40/M input, $3.20/M output
- Model ID: `Qwen/Qwen3.5-122B-A10B`

### Qwen 3.6 35B A3B FP8

Fast mixture-of-experts language model with ~3B active parameters per token. Strong at reasoning, coding, and multilingual tasks.

- 262K context, $0.17/M input, $1.10/M output
- Model ID: `Qwen/Qwen3.6-35B-A3B-FP8`

### Qwen3.7 Max

Qwen's most capable proprietary model with 1M context window. Strong at reasoning, coding, math, and multilingual tasks.

- 1000K context, $2.80/M input, $7.50/M output
- Model ID: `qwen/qwen3.7-max`

### Qwen3-Embedding-0.6B

Latest proprietary model of the Qwen family, specifically designed for text embedding tasks.

- 41K context, $0.01/M input, $0.01/M output
- Model ID: `Qwen/Qwen3-Embedding-0.6B`

### Qwen3-Reranker-0.6B

Designed for text embedding and ranking tasks.

- 41K context, $0.01/M input, $0.01/M output
- Model ID: `Qwen/Qwen3-Reranker-0.6B`

### Qwen3-VL-30B-A3B-Instruct

Vision-language model supporting text and image inputs.

- 256K context, $0.15/M input, $0.55/M output
- Model ID: `Qwen/Qwen3-VL-30B-A3B-Instruct`

### GLM 5.1

Open-source foundation model built for complex systems engineering and long-horizon agent workflows. Production-grade productivity for large-scale programming tasks, with performance aligned to top closed-source models.

- 203K context, $0.85/M input, $3.30/M output
- Model ID: `zai-org/GLM-5.1-FP8`
