# Reasoning Models Configuration

Some models in NEAR AI Cloud support advanced reasoning capabilities that allow them to "think" through problems before providing a final answer. This feature can improve the quality of responses for complex tasks that require step-by-step reasoning.

## Overview

Reasoning models can process information in two stages:

1. **Thinking stage** — Internal reasoning process (not shown in final output by default)
2. **Response stage** — The final answer provided to the user

You control whether a model uses reasoning by configuring `chat_template_kwargs` in your API requests.

## DeepSeek V3.1

Uses the `thinking` parameter inside `chat_template_kwargs`.

### Enable reasoning

```bash
curl https://cloud-api.near.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "model": "deepseek-ai/DeepSeek-V3.1",
    "messages": [{"role": "user", "content": "What is sqrt of 11"}],
    "temperature": 1,
    "n": 1,
    "chat_template_kwargs": { "thinking": true },
    "stream": true
  }'
```

### Disable reasoning

Omit `chat_template_kwargs` or set `"thinking": false`.

## GLM-5

Uses `enable_thinking`. Reasoning is **enabled by default**.

### Default (reasoning enabled)

```bash
curl https://cloud-api.near.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "model": "zai-org/GLM-5-FP8",
    "messages": [{"role": "user", "content": "How much is 2+2?"}],
    "temperature": 0.4,
    "n": 1,
    "chat_template_kwargs": { "enable_thinking": true },
    "stream": true
  }'
```

### Disable

Explicitly set `"enable_thinking": false`.

## Qwen3.5-122B

Reasoning is enabled by default. The model will include `reasoning_content` in responses automatically.

### Disable

```bash
curl https://cloud-api.near.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "model": "Qwen/Qwen3.5-122B-A10B",
    "messages": [{"role": "user", "content": "What is sqrt of 17?"}],
    "chat_template_kwargs": { "enable_thinking": false },
    "stream": true
  }'
```

## Model-specific Parameter Names

| Model | Model ID | Parameter | Default |
|---|---|---|---|
| DeepSeek V3.1 | `deepseek-ai/DeepSeek-V3.1` | `thinking` | false |
| GLM-5 | `zai-org/GLM-5-FP8` | `enable_thinking` | true |
| Qwen3.5-122B | `Qwen/Qwen3.5-122B-A10B` | `enable_thinking` | true |

> Always check the model documentation or use the model's specific parameter name. Using the wrong parameter name will not enable reasoning.

## When to Use Reasoning

Useful for:

- Complex mathematical problems
- Logical reasoning, step-by-step analysis
- Code generation that needs careful planning
- Scientific questions requiring structured thinking

Skip reasoning for:

- Simple queries with direct answers
- When latency is critical
- Cost optimization (reasoning increases token usage)

## Best Practices

- Test with and without reasoning to compare output quality for your use case
- Monitor token usage — reasoning increases costs
- Use appropriate models — not all support reasoning
- Stream responses when reasoning is on, for better UX on longer outputs
