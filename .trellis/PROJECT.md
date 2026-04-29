# BioTreLlises — Project Context

> Loaded by all AI agents working on this project. Not a spec, not a PRD — the "why we exist" document.

---

## Vision

BioTreLlises is an open-source **Bio AI Scientist Agent** built on the pi-mono agent framework. It lets biologists describe scientific questions in natural language, and the agent autonomously orchestrates multi-database, multi-tool analysis workflows.

Core value proposition: **Turn a 3-day analysis marathon into a 5-minute conversation.**

## Three Principles

1. **Don't reinvent bio data wheels** — Reuse BioPython, NCBI API, UniProt REST, existing ecosystem. The agent is an orchestrator, not a data provider.
2. **Build the reasoning orchestration layer** — Scientific question → hypothesis decomposition → data retrieval → method selection → result interpretation → constraint validation → iteration.
3. **Leverage pi-mono's engineering advantage** — TUI interaction, multi-model strategy, extension ecosystem, session management.

## What Makes This Different

- **Not another bio Python library** — there are hundreds of those
- **Not a ChatGPT wrapper** — this is an agent that autonomously reasons, plans, and executes
- **The core moat**: Agent attention bandwidth. An agent can hold 20+ constraints simultaneously and iterate across combinatorial design spaces — human working memory caps at ~4.

## Architecture (layers)

```
User (natural language)
  → Bio Reasoning Engine (Planner → Executor → Aggregator)
    → Bio Tool Registry (TypeBox schemas, ~6 tools MVP)
      → Data Connectors (TypeScript HTTP, ~5 sources MVP)
        → Cache Layer
```

## Target Users

- Bioinformatics researchers who run multi-step analyses daily
- Synthetic biologists designing genetic constructs
- Anyone doing cross-database, cross-tool biology research

## License & Model

MIT. Open source. Personal project. Long-term commitment.
