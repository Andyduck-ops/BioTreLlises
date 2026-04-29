# Bio Agent Design Thinking Guide

> When designing tools, reasoning engines, or UI — keep coming back to this question: "Where is the agent's attention bandwidth the 10x multiplier?"

---

## Core Insight

An agent's **irreplaceable advantage** is not speed. It's not convenience.

**It's the ability to hold ALL constraints simultaneously across a massive combinatorial design space, execute hundreds of trial-and-error rounds without losing context.**

A human doing bioinformatics analysis:
- Opens sequence editor → remembers restriction sites → switches to primer design tool → forgets a constraint → goes back → finds conflict with another component → starts over
- Essentially searching a 5-10 constraint intersection space with ~4-item working memory

An agent doing the same:
- All constraints loaded at once → traverses hundreds of combinations → auto-validates each round → picks Pareto-optimal
- **Bandwidth ceiling = context window, not working memory**

---

## Design Heuristics

### When evaluating a feature or tool

Ask: "Does this exploit the agent's attention bandwidth, or is it just wrapping an existing tool in a chat interface?"

Good (leverages attention bandwidth):
- Multi-constraint co-optimization (e.g., gRNA design: on-target score × off-target risk × structural accessibility × conservation)
- Cross-database inference (e.g., gene → pathway → disease → drug target, across 5 databases)
- Hypothesis iteration loops (generate → test against data → refine → retest)
- Parallel tool execution with results synthesis

Bad (just wrapping):
- "Search NCBI for gene X" (a REST call with a chat wrapper)
- "Show me protein Y's structure" (one API call, no reasoning)
- Single-tool, single-turn Q&A

### When designing the reasoning engine

- The Planner should decompose into PARALLEL sub-problems whenever possible (exploit concurrency)
- The Executor should give each sub-problem only the tools it needs (reduce tool selection error)
- The Aggregator should CROSS-VALIDATE across sources (the agent sees contradictions humans miss)
- **The Planner and Aggregator should be LLM-driven** — keyword matching is fast but semantically blind. Use LLM sub-agents (no tools, pure reasoning) for decomposition and synthesis, with keyword-based fallbacks for resilience.
- **Never trust LLM output without sanitization** — strip markdown blocks, validate enums, provide fallback chains. The LLM is the brain, not the contract.
- **Tool count matters** — sub-agents should receive only the tools they need. An agent with 20 tools makes worse choices than an agent with 3 relevant tools.

### When adding tools

- Tools are building blocks for reasoning, not the product itself
- Tool descriptions must be detailed enough for LLM to choose correctly in context
- Prefer fewer, more powerful tools over many narrow ones (reduces selection error)
- Each tool should return structured data that can be referenced by downstream tools

---

## Anti-Patterns

| Pattern | Why wrong |
|---------|-----------|
| Building a tool for every API endpoint | Tools are for reasoning, not for mirroring API surfaces |
| Single-turn chat design | The value is in multi-step autonomous loops |
| Ignoring tool execution parallelism | Sequential-only wastes the agent's ability to fan out |
| Treating uncertainty as failure | Biology is inherently uncertain — flag it, don't hide it |
| Building before thinking about attention leverage | If the agent's bandwidth isn't the 10x multiplier, why build it? |
