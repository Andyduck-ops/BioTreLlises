# Quality Guidelines

> Code quality standards for BioTreLlises core. Inherits pi-mono conventions, adds bio-specific rules.

---

## Inherited from pi-mono

- No `any` types unless absolutely necessary
- Never use inline imports (`await import(...)`, `import("pkg").Type`)
- Never downgrade code to fix type errors from outdated dependencies
- Run `npm run check` after code changes (NOT documentation-only)
- Never hardcode keybindings — all must be configurable
- Never commit unless user asks
- `git add <specific-files>` — never `git add -A` or `git add .`

---

## BioTreLlises-Specific

### TypeBox for ALL tool schemas

```typescript
// CORRECT
const geneSearchTool: AgentTool = {
  name: 'gene_search',
  parameters: Type.Object({
    query: Type.String({ description: 'Gene symbol, name, or ID' }),
    organism: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Number({ default: 10, maximum: 100 })),
  }),
  execute: async (id, params) => { /* ... */ },
};
```

### Connector tests MUST mock HTTP

```typescript
import nock from 'nock';

test('ncbi gene search', async () => {
  nock('https://eutils.ncbi.nlm.nih.gov')
    .get('/entrez/eutils/esearch.fcgi')
    .query({ db: 'gene', term: 'TP53', retmode: 'json' })
    .reply(200, { esearchresult: { idlist: ['7157'] } });

  const result = await ncbiClient.search('gene', 'TP53');
  expect(result.ids).toEqual(['7157']);
});
```

### Tool tests use faux provider

Use pi-ai's faux provider for deterministic LLM responses. Never hit real APIs in tests.

### Session reproducibility

Analysis results MUST be reproducible from session JSONL:
- All tool inputs recorded in session
- All external API responses cached
- No non-deterministic logic in tool execution

---

## Forbidden Patterns

| Pattern | Reason | Alternative |
|---------|--------|-------------|
| `any` in tool parameters | Breaks TypeBox | Proper schema |
| Hardcoded API keys | Security | Env vars / `auth.json` |
| Direct `fetch()` in tools | No cache/retry/errors | Connector class |
| Cross-tool imports | Tight coupling | Communicate via agent state |
| `setTimeout` for coordination | Race conditions | async/await or events |
| `if (ttl)` for TTL validation | `ttl: 0` is valid (immediate expiry) | `ttl !== undefined && ttl >= 0` |
| Assumed `error` event on Agent | pi-agent-core has no `error` event type | Wrap `agent.prompt()` in try-catch |
| Direct `content.filter()` on message | `content` may be `string` or `Array` | `Array.isArray(content)` guard first |
| Naive JSON.parse() on LLM output | LLM may wrap JSON in markdown blocks | Strip code blocks before parsing |
| LLM output without runtime validation | LLM may hallucinate enum values | Filter against `VALID_CATEGORIES` |
| Creating Planner/Aggregator without fallback | LLM API may fail or be unavailable | Always provide fallback implementation |

---

## LLM Reasoning Engine Patterns

### LLM-Driven Decomposition

Use a sub-agent with NO tools to decompose queries into structured plans.

```typescript
// CORRECT — LLMPlanner pattern
class LLMPlanner implements Planner {
  constructor(private agent: BioAgent, private fallback: Planner = new KeywordPlanner()) {}

  async plan(query: string, registry: BioToolRegistry): Promise<Plan> {
    try {
      const subAgent = this.agent.createSubAgent("planner", []);  // no tools
      // ... subscribe to events, extract text, parse JSON ...
      return this.parsePlanJson(rawText, query);
    } catch {
      return this.fallback.plan(query, registry);  // never fail silently
    }
  }
}
```

**Rules**:
1. Sub-agent needs NO tools (it only reasons, does not call bio APIs)
2. Prompt must enumerate available tool categories explicitly
3. Parse response with markdown code block stripping
4. Validate tool categories against `VALID_CATEGORIES` at runtime
5. Always have a fallback (KeywordPlanner)

### Structured JSON Prompt

LLM outputs must be parsed defensively:

```typescript
// CORRECT — strip markdown and validate fields
private parsePlanJson(raw: string): Plan {
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const json = codeBlockMatch ? codeBlockMatch[1] : raw;
  const parsed = JSON.parse(json) as Record<string, unknown>;

  if (!Array.isArray(parsed.subProblems)) throw new Error("missing subProblems");

  return {
    subProblems: parsed.subProblems.filter(
      (sp) => VALID_CATEGORIES.includes(sp.toolCategories[0])
    ),
    reasoning: String(parsed.reasoning),
  };
}

// WRONG — naive parse without guards
const plan = JSON.parse(rawText);  // crashes on markdown blocks, missing fields, invalid enums
```

### BioTuiPipeline

Pass the reasoning pipeline as a single object to the TUI:

```typescript
export interface BioTuiPipeline {
  planner: Planner;
  executor: Executor;
  aggregator: Aggregator;
  registry: BioToolRegistry;
}

// Usage
const app = new BioTuiApp({
  agent,
  pipeline: { planner, executor, aggregator, registry },
});
```

**Why**: Bundling ensures TUI always has all four components together. The TUI falls back to direct `agent.prompt()` when no pipeline is provided.

---

## Testing Requirements

- Each connector: unit tests with HTTP mocks (nock)
- Each tool: unit tests with faux provider
- Reasoning engine: integration tests with mock connectors
- 3 e2e scenarios run before each release
