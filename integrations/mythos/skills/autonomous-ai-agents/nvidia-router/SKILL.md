---
name: nvidia-router
description: "Recommend the best Mythos/NVIDIA model for a task and keep the routing decision auditable without pretending to switch models automatically."
version: 1.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [nvidia, nim, model-selection, routing, audit]
    category: autonomous-ai-agents
    related_skills: [mythos-agent, congchain]
---

# NVIDIA Router

Use this skill when a user asks which model Mythos should use for a task, or
when a session needs an auditable model-selection note before the real runtime
switching path exists.

## Safety Contract

- V1 recommends a model; it does not switch Mythos automatically.
- Do not claim `pre_llm_call` changed the active model.
- Do not expose API keys or suggest per-model keys when one provider key is enough.
- Say "registered in CongChain", "auditable", or "verifiable".
- Say "on-chain" only after an explicit blockchain anchor endpoint is called.

## Routing Table

| Task type | Primary model | Fallback | Use for |
| --- | --- | --- | --- |
| Default agent loop | `nvidia/nemotron-3-super-120b-a12b` | `meta/llama-3.3-70b-instruct` | Mixed tasks, tool use, autonomous loop |
| Heavy reasoning | `openai/gpt-oss-120b` | `nvidia/nemotron-3-super-120b-a12b` | Math, architecture, planning, deep analysis |
| Code/debugging | `deepseek-ai/deepseek-v4-pro` | `qwen/qwen3.5-122b-a10b` | Code, tests, APIs, PRs, DevOps |
| Long context | `moonshotai/kimi-k2.6` | `qwen/qwen3.5-122b-a10b` | Repositories, PDFs, transcripts, long sessions |
| Fast/cheap | `microsoft/phi-4-mini-instruct` | `google/gemma-3n-e2b-it` | Short answers, extraction, formatting, checks |
| Portuguese/multilingual | `z-ai/glm-5.1` | `meta/llama-3.3-70b-instruct` | Portuguese, translation, multilingual UX |
| Creative/content | `google/gemma-4-31b-it` | `mistralai/mistral-large-3-675b-instruct-2512` | Posts, scripts, copywriting, ideation |

## Recommended Env Shape

Prefer provider-level keys:

```bash
NVIDIA_API_KEY=...
OPENROUTER_API_KEY=...
```

Keep model names in config or documentation. Do not create one secret variable
per model unless those models truly require different provider accounts.

## Operator Output

When explaining a decision, use this format:

```text
NVIDIA Router recommendation
Task class: code/debugging
Recommended model: deepseek-ai/deepseek-v4-pro
Fallback: qwen/qwen3.5-122b-a10b
Reason: the task requires repository-aware code analysis and tests.
Contract: recommendation only; the active runtime model changes only through a supported Mythos model/config path.
CongChain: decision can be registered as verifiable metadata.
```
