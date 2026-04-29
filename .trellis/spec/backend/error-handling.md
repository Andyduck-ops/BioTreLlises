# Error Handling

> How errors flow: external API failures → tool errors → user-facing messages.

---

## Error Classification

| Category | Examples | Handling |
|----------|----------|----------|
| **Connector errors** | NCBI timeout, UniProt 503, rate limit | Catch → retry with backoff → if exhausted, return typed error |
| **Tool errors** | Invalid gene symbol, BLAST no hits | Throw Error → agent catches → `isError: true` |
| **Reasoning errors** | Planner deadlock, executor failure | Catch → partial results + error markers to Aggregator |
| **User errors** | Malformed query, unsupported organism | Validate early → clear guidance message |

---

## Connector Error Handling

```typescript
class ConnectorError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number | null,
    public readonly retryable: boolean,
    public readonly endpoint: string
  ) {
    super(message);
    this.name = 'ConnectorError';
  }
}

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatuses: [429, 503, 502, 504],
};
```

**Rule**: Connectors retry automatically for transient errors. Non-retryable errors propagate up.

---

## Tool Error Handling

Throw on failure — do NOT return error as content:

```typescript
// CORRECT
execute: async (id, params) => {
  if (!params.gene) throw new Error('Gene symbol is required');
  const result = await ncbiClient.search('gene', params.gene);
  if (!result) throw new Error(`Gene not found: ${params.gene}`);
  return { content: [{ type: 'text', text: formatResult(result) }] };
};

// WRONG
execute: async (id, params) => {
  if (!params.gene) {
    return { content: [{ type: 'text', text: 'Error: gene required' }] };
  }
};
```

Pi-agent-core catches thrown errors, formats them as tool results with `isError: true`. The LLM receives error context and can retry.

---

## Agent Event Error Handling

**Critical**: pi-agent-core's event stream does NOT include an `error` event type. Agent-level failures are surfaced via the Promise returned by `agent.prompt()` — they are NOT emitted as events.

```typescript
// CORRECT — errors caught by try-catch
const unsub = agent.subscribe((event) => {
  switch (event.type) {
    case "agent_start": /* ... */ break;
    case "tool_execution_start": /* ... */ break;
    case "tool_execution_end": /* ... */ break;
    case "agent_end": /* ... */ break;
    case "message_end": /* ... */ break;
    // NO "error" case — it doesn't exist
  }
});

try {
  await agent.prompt(query);
} catch (error) {
  // Handle agent-level errors here
}
```

---

## Reasoning Engine Error Handling

Sub-problems run independently. If one fails:
1. Other sub-problems continue
2. Failed sub-problem returns error marker
3. Final report flags sections with "⚠ Analysis incomplete: [reason]"

```typescript
const results = await Promise.allSettled(
  subProblems.map(p => executeSubProblem(p, context))
);
```

---

## LLM Reasoning Error Handling

The LLMPlanner and LLMAggregator can fail in three ways. Each must trigger fallback.

### Error Matrix

| Failure | Trigger | Fallback |
|---------|---------|----------|
| LLM API unavailable | `subAgent.prompt()` rejects | KeywordPlanner / SimpleAggregator |
| Invalid JSON | `JSON.parse()` throws | KeywordPlanner / SimpleAggregator |
| Missing required fields | Runtime validation fails | KeywordPlanner / SimpleAggregator |
| Invalid enum value (e.g., tool category) | `VALID_CATEGORIES` filter drops all | Fallback produces empty Plan, Executor skips |

### Implementation Pattern

```typescript
// CORRECT — catch-all fallback
async plan(query: string, registry: BioToolRegistry): Promise<Plan> {
  try {
    return await this.llmPlan(query, registry);
  } catch {
    return this.fallback.plan(query, registry);  // never crash the TUI
  }
}

// WRONG — selective catch only catches JSON.parse errors
async plan(query: string, registry: BioToolRegistry): Promise<Plan> {
  const raw = await this.callLlm(query);
  try {
    return JSON.parse(raw);  // misses API errors, timeout errors
  } catch {
    return this.fallback.plan(query, registry);
  }
}
```

### LLM Output Sanitization

Always strip markdown code blocks before JSON parsing:

```typescript
const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
const json = codeBlockMatch ? codeBlockMatch[1] : raw;
```

**Why**: GPT-4, Claude, and other models frequently wrap JSON responses in triple backticks even when instructed not to.
