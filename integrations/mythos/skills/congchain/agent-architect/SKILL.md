---
name: agent-architect
description: "Design multi-agent Mythos systems with delegation, skills, memory boundaries, governance, and CongChain shared context."
version: 2.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [multi-agent, architecture, delegation, kanban, governance, memory]
    category: congchain
    related_skills: [multimodel-sync, confidence-calibration, chain-graph]
    requires_toolsets: [delegation, kanban, file]
---

# Agent Architect

Use this skill when designing a system where Mythos coordinates with workers,
specialist agents, tools, schedules, or external platforms.

## Safety Contract

- Do not create autonomous fund movement.
- Do not schedule value-moving actions.
- Do not let subagents access secrets unless an explicit secured runtime exists.
- Make memory boundaries clear: what is local, what is saved in CongChain, and
  what is anchored.
- Require human review before saving high-impact conclusions.

## Architecture Patterns

### Dispatcher + Specialists

Use for research, code review, and support workflows.

```text
Mythos Dispatcher
  -> Solana Specialist
  -> Web Research Specialist
  -> Code Review Specialist
  -> Summary/Audit Specialist
```

### Sequential Pipeline

Use when each step depends on the previous result.

```text
Collect evidence -> Analyze -> Review risk -> Save memory -> Notify operator
```

### Review Loop

Use for critical decisions.

```text
Builder -> Reviewer -> Builder revision -> Human approval -> CongChain memory
```

## Design Checklist

- User goal:
- Required skills:
- Required tools:
- Provider/model routing:
- Memory write points:
- Human approval points:
- Safety boundaries:
- Observability fields:
- Failure/rollback plan:

## CongChain Shared Memory Pattern

1. A specialist returns a reviewed summary.
2. Mythos saves only approved, redacted context through `/api/memory/write`.
3. The returned hash becomes the handoff pointer.
4. Another agent resumes from the hash instead of receiving hidden prompt data.

## Output Format

```text
Agent System Design

Goal:
Agents:
Skills:
Tools:
Memory plan:
Safety plan:
Observability:
Rollout steps:
```

## Pitfalls

- Too many subagents increases latency and cost.
- Shared memory without provenance becomes confusing.
- Scheduling without review can create unsafe automation.
- Delegation should produce receipts, not invisible work.
