# What "Token in" and "Token out" Mean

Quick reference for the `Tokens` field in the Scanner panel and the per-row numbers in `/usage`.

---

## TL;DR

| Term in the UI | What it really is |
|---|---|
| **Tokens in** | How many tokens your prompt got chopped into before the model read it. Includes the entire chat history sent up. |
| **Tokens out** | How many tokens the model generated as its reply. |
| **Total tokens** | `in + out`. What NEAR uses to compute the bill. |
| **`prompt_tokens`** (raw NEAR field) | Same as "tokens in" |
| **`completion_tokens`** (raw NEAR field) | Same as "tokens out" |

So when the Scanner shows `14 in · 597 out`, you sent a 14-token prompt and the model produced a 597-token reply.

---

## What's a token, exactly?

A **token** is a chunk of text the model uses as its smallest unit. It's usually a sub-word — sometimes a whole word, sometimes a few characters, sometimes a punctuation mark on its own. Different models use different tokenizers, so the same English sentence can break into slightly different counts across providers.

Rough rule of thumb for English text:

| Length | ≈ Tokens |
|---|---|
| 1 character | ~0.25 tokens |
| 1 word (avg) | ~1.3 tokens |
| 100 words | ~135 tokens |
| 1 paragraph | ~50–80 tokens |
| 1 page (250 words) | ~330 tokens |

Code is tokenized differently — `{}`, `()`, `;`, and language keywords each take a token, so dense code is roughly **1.5–2× more tokens than the same character count of prose**.

Numbers, JSON, and non-Latin scripts (Hindi, Chinese, Arabic) tokenize *worse* — they can hit 2–4 tokens per character.

---

## Why are there two numbers (in vs out)?

Because models are paid for **both** sides of the conversation, but at different rates.

**Tokens in (prompt tokens)** are what the model has to *read* to understand what you want. They include:

- Your latest message
- Every previous message in the same chat (full history is re-sent on each turn)
- Any system prompt
- Tool definitions if you're using function calling

**Tokens out (completion tokens)** are what the model *generates* as its response — what you actually see in the chat bubble.

Generation is slower and more expensive than reading (the model has to run a forward pass per token), so output tokens almost always cost **2–5× more per million** than input tokens.

NEAR's per-million pricing matches this convention. For example, from `md/02-available-models.md`:

| Model | Input $/M | Output $/M | Ratio |
|---|---|---|---|
| Claude Opus 4.7 | $5.00 | $25.00 | 5× |
| GLM 5.1 | $0.85 | $3.30 | ~4× |
| GPT-OSS 120B | $0.15 | $0.55 | ~3.7× |
| Qwen3 30B A3B | $0.15 | $0.55 | ~3.7× |
| DeepSeek V3.1 | $1.00 | $2.50 | 2.5× |

---

## Worked example — the receipt you actually got

From the Scanner panel earlier:

```
Model:    Qwen/Qwen3-30B-A3B-Instruct-2507
Tokens:   14 in · 597 out
```

Cost computation (`frontend/lib/usage.ts → receiptToEvent`):

```
input  cost  = (14  / 1_000_000) × $0.15  = $0.0000021
output cost  = (597 / 1_000_000) × $0.55  = $0.000328
                                            ─────────
total                                    ≈  $0.00033
```

So that one Qwen3 reply cost **roughly a third of a cent** — about 1/3000th of a dollar. With Claude Opus 4.7 the same call would have cost:

```
input  = (14  × $5)  / 1M = $0.00007
output = (597 × $25) / 1M = $0.0149
                            ─────────
total                     ≈ $0.015
```

So the same 14-in/597-out call on Opus is ~45× pricier (and probably 3× smarter) than on Qwen3. The picker lets you choose where on the price/intelligence curve you sit per request.

---

## What "across all projects" means on `/usage`

The `Total Tokens` stat card sums `totalTokens` across **every** logged completion in the selected time range. There's no per-project filtering yet because Confide doesn't have a project model — every chat is implicitly one workspace. When projects land (post-MVP), the same number will roll up per project.

`Total Cost` is the same idea but with USD. The number you see is *the price NEAR charged us* — we don't apply markup in the displayed total. (The pricing tiers on the landing page apply markup at billing time, not in the dashboard view.)

---

## How tokens grow in a multi-turn chat

This is the part most people get wrong. Each turn re-sends the full conversation history, so:

| Turn | Tokens you typed | What NEAR sees as `tokens in` |
|---|---|---|
| 1 | 10 | 10 |
| 2 | 8 | 10 (turn 1 user) + 600 (turn 1 reply) + 8 (turn 2 user) = **618** |
| 3 | 12 | turn 1 + 1 reply + turn 2 + 2 reply + turn 3 = potentially 1,500+ |

Within a long thread, the input tokens balloon every turn, and the cost climbs even though you "only typed a few words." If you see a 30-message chat suddenly cost a few cents, that's why. Start a new chat when context isn't useful — it resets the counter.

---

## Where the numbers come from in the code

| Source | File | Field name in code |
|---|---|---|
| NEAR's raw response | `/v1/chat/completions` | `usage.prompt_tokens`, `usage.completion_tokens`, `usage.total_tokens` |
| Confide's normalized shape | `frontend/lib/types.ts` | `receipt.usage.promptTokens / completionTokens / totalTokens` |
| Cost computation | `frontend/lib/usage.ts → receiptToEvent` | `inputCostUSD`, `outputCostUSD`, `totalCostUSD` |
| Aggregation | `frontend/lib/usage.ts → aggregate` | `totalTokens`, `totalCostUSD` summed across events |
| Backend mirror | `backend/src/lib/pricing.ts` + `usage-store.ts` | Same shape, persisted to `data/usage.jsonl` |

All four places use the same names, so the term you see in the UI maps directly to the term in the code with no translation step.

---

## What the Scanner panel does NOT show

- **Reasoning tokens** (for models that support them — Claude Opus, GLM-5, Qwen3.5). NEAR returns a `completion_tokens_details.reasoning_tokens` sub-field; we don't surface it yet because it's not billed separately on NEAR's pricing — but it's worth showing later for transparency on "why was the answer slow / expensive."
- **Cached input tokens.** NEAR may return `prompt_tokens_details.cached_tokens` for the cache-hit portion of a long prompt. Doesn't affect us yet because we don't use prompt caching anywhere, but if we add it the savings would show here.
- **Per-token cost.** We compute the totals; we don't draw per-token. If you want the "how much did THIS one word cost" view, that's a heatmap project.
