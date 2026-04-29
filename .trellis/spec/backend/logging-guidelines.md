# Logging & Observability

> BioTreLlises uses pi-agent-core's event stream as primary observability. Every significant action is an event.

---

## Event-Based Observability

Pi-agent-core emits structured events for every lifecycle stage. Bio-specific extensions:

| Event | When | Key fields |
|-------|------|------------|
| `turn_start` | New reasoning turn | `turnIndex`, `subProblems` |
| `tool_execution_start` | Tool begins | `toolName`, `params` (redacted), `connectorInUse` |
| `tool_execution_end` | Tool completes | `toolName`, `durationMs`, `cacheHit`, `resultSize` |
| `reasoning_plan` | Planner produces a plan | `planSteps`, `estimatedTools` |
| `connector_call` | External API called | `endpoint`, `cacheHit`, `latencyMs` |
| `aggregation_complete` | Report generated | `sectionCount`, `uncertaintyFlags` |

---

## What to Log

- External API calls (endpoint + latency + cache status)
- Tool execution (name + duration + error if any)
- Reasoning plan steps (for debugging planner behavior)
- Rate limit encounters (for monitoring)

## What NOT to Log

- Full API response bodies (wasteful)
- User prompt text in logs (privacy)
- Generated report content (belongs in session, not logs)

---

## Format

Structured, machine-readable:

```typescript
// Development
console.log(`[connector:ncbi] GET /esearch?db=gene&term=TP53 → 200 (miss, 234ms)`);

// Production
writeLog({
  timestamp: Date.now(),
  category: 'connector',
  provider: 'ncbi',
  endpoint: '/esearch.fcgi',
  cacheHit: false,
  latencyMs: 234,
});
```

---

## Cost Tracking

Pi-ai already tracks token usage and cost per LLM call via `usage` fields. No extra work needed.
