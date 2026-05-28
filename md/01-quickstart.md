# NEAR AI Cloud Quickstart

NEAR AI Cloud offers developers access to secure, private, verifiable AI models through a unified API. This quickstart guide will walk you through creating an account and making your first requests in minutes.

## Setup

1. **Create your account** — Sign up at [cloud.near.ai](https://cloud.near.ai)
2. **Add Credits** — Go to the "Credits" section and purchase credits based on your needs
3. **Generate API Key** — Go to the "API Keys" section and generate a new key

> **Keep Your API Key Safe**
> Never share your API key publicly or commit it to version control. If compromised, you can regenerate it anytime from your dashboard.

## Make Your First API Call

NEAR AI Cloud uses an OpenAI-compatible API, making it easy to integrate with existing tools and libraries. You can connect through the gateway (`cloud-api.near.ai`) or directly to a model's own endpoint (`{slug}.completions.near.ai`).

> Replace `YOUR_API_KEY` with the API key you generated in the setup steps above.

### Gateway — `/v1/chat/completions`

The gateway routes your request to the appropriate model TEE:

```bash
curl https://cloud-api.near.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "deepseek-ai/DeepSeek-V3.1",
    "messages": [{
      "role": "user",
      "content": "Hello, NEAR AI!"
    }]
  }'
```

### Expected Response

```json
{
  "id": "chatcmpl-d17ba5d9f393440591562f4ff006f246",
  "object": "chat.completion",
  "created": 1762892406,
  "model": "deepseek-ai/DeepSeek-V3.1",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello there! 👋 Welcome to the NEAR ecosystem! \n\nHow can I assist you today?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 13,
    "total_tokens": 75,
    "completion_tokens": 62
  }
}
```

All inference is performed within Trusted Execution Environments (TEEs), ensuring your data remains private and verifiable.

## Using OpenAI SDKs

For advanced features like streaming, async operations, Files API, and Conversations API, see the OpenAI Compatibility Guide.

## Next Steps

- **Explore Models** — Browse available AI models including DeepSeek, OpenAI, Qwen, and GLM
- **Private Inference** — Learn about the secure architecture and how your data is protected
- **Verification** — Understand how to verify and validate secure interactions with AI models
- **OpenAI Compatibility** — Use standard OpenAI SDKs with streaming, async, Files API, and more
