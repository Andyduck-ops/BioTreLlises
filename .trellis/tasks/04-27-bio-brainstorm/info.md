# Technical Design: BioTreLlises Bio AI Scientist Agent

## Architecture Layers

```
User Input (natural language)
        │
        ▼
┌─ Bio Reasoning Engine ────────────────────────────┐
│  PlannerLLM (decompose question → sub-problems)   │
│  Executor (parallel/serial sub-problem dispatch)   │
│  AggregatorLLM (merge results → structured report) │
└──────────────────┬────────────────────────────────┘
                   │ sub-problems require tool calls
                   ▼
┌─ BioToolRegistry ─────────────────────────────────┐
│  gene_search │ protein_info │ pubmed_search       │
│  pathway_enrich │ blast │ disease_link            │
└──────────────────┬────────────────────────────────┘
                   │ each tool wraps a connector
                   ▼
┌─ Data Connectors ─────────────────────────────────┐
│  NCBI E-utils │ UniProt REST │ PubMed E-utils     │
│  KEGG REST │ PDB REST │ ClinVar REST              │
│              ↕ (cache check/update)               │
│  Cache Layer (SQLite / JSONL)                     │
└───────────────────────────────────────────────────┘
```

---

## 1. Bio Reasoning Engine

### 1.1 Planner

**Input**: User's natural language question
**Output**: `PlanStep[]` — ordered list of sub-problems with tool suggestions

```
User: "水稻干旱胁迫上调基因的通路和药物靶点"
  ↓
PlannerLLM (reasoning model, e.g. claude-sonnet-4)
  ↓
Plan:
  1. [gene_search] Find drought stress upregulated genes in rice
     → depends on: none
  2. [pathway_enrich] KEGG pathway enrichment for genes from step 1
     → depends on: step 1
  3. [pubmed_search] Literature on drought stress pathways in rice
     → depends on: none (parallel with 1, 2)
  4. [disease_link] Drug target associations for key hub genes
     → depends on: step 1
```

**Implementation**: A single `complete()` call with a system prompt that teaches biological reasoning decomposition. No external planner framework.

```typescript
interface PlanStep {
  id: string;
  description: string;       // Human-readable sub-question
  suggestedTools: string[];  // Tool names likely needed
  dependsOn: string[];       // PlanStep IDs this step needs
  status: 'pending' | 'ready' | 'running' | 'done' | 'error';
}
```

### 1.2 Executor

Runs sub-problems according to dependency graph.

**Algorithm**:
1. Find all `ready` steps (dependencies all `done`)
2. Execute concurrent steps in parallel (Promise.all)
3. Each step = Agent.prompt(sub-question) → LLM calls tools → accumulates results
4. Mark step `done` → unlock dependents → repeat
5. If step errors, mark `error` but continue other branches

**Key**: Each sub-problem gets its own Agent instance with a subset of tools (only the relevant ones), reducing tool selection errors.

```typescript
async function executePlan(plan: PlanStep[], agent: BioAgent): Promise<StepResult[]> {
  const results: StepResult[] = [];

  while (plan.some(s => s.status === 'ready')) {
    const ready = plan.filter(s => s.status === 'ready');

    // Run parallel-ready steps concurrently
    const batch = await Promise.allSettled(
      ready.map(step => executeSubProblem(step, agent, getToolsForStep(step)))
    );

    for (const [i, result] of batch.entries()) {
      if (result.status === 'fulfilled') {
        ready[i].status = 'done';
        results.push(result.value);
      } else {
        ready[i].status = 'error';
        results.push({ stepId: ready[i].id, error: result.reason });
      }
    }
  }

  return results;
}
```

### 1.3 Aggregator

Takes all `StepResult[]` and produces a structured report.

**Report template**:
```markdown
# Analysis Report: {question}

## Summary
{1-2 paragraph synthesized conclusion}

## Key Findings
1. **{finding}** — Evidence: {source}, Confidence: {high/medium/low}
2. ...

## Methods Used
- {tool_name}: {what was done}
- ...

## Data Sources
| Source | Query | Results | Timestamp |
|--------|-------|---------|-----------|

## Caveats
- {limitation of analysis}
- {data freshness concern}
```

---

## 2. BioToolRegistry Contract

### Interface

```typescript
interface BioToolRegistry {
  // Register a tool (called at startup)
  register(tool: AgentTool): void;

  // Get all registered tools (for agent initialization)
  getAll(): AgentTool[];

  // Get tools by category (for sub-problem tool filtering)
  getByCategory(category: 'sequence' | 'structure' | 'pathway' | 'literature' | 'disease'): AgentTool[];

  // Get tools by name pattern (for planner suggestions)
  suggest(description: string): AgentTool[];
}
```

### Registration pattern

Each tool file exports a factory function:

```typescript
// tools/gene-search.ts
export function createGeneSearchTool(ncbiClient: NcbiClient): AgentTool {
  return {
    name: 'gene_search',
    label: 'Gene Search',
    description: 'Search for genes by symbol, name, or ID across organisms. Returns gene metadata, genomic location, and linked sequences.',
    parameters: Type.Object({
      query: Type.String({ minLength: 1, description: 'Gene symbol, name, or NCBI Gene ID' }),
      organism: Type.Optional(Type.String({ description: 'Species name or taxonomy ID' })),
      limit: Type.Optional(Type.Number({ default: 10, maximum: 100 })),
    }),
    category: 'sequence',
    execute: async (toolCallId, params, signal) => {
      const results = await ncbiClient.searchGene(params.query, params.organism, params.limit);
      return {
        content: [{ type: 'text', text: formatGeneResults(results) }],
        details: { query: params.query, count: results.length },
      };
    },
  };
}
```

---

## 3. Connector Pattern

Every connector follows the same interface:

```typescript
interface BioConnector {
  readonly name: string;
  readonly baseUrl: string;
  readonly rateLimit: { requestsPerSecond: number; maxRetries: number };

  // Internal: all connectors use this for HTTP + cache + retry
  request<T>(endpoint: string, params: Record<string, string>): Promise<T>;
}
```

Connector implementation pattern:

```typescript
class NcbiConnector implements BioConnector {
  name = 'ncbi';
  baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  rateLimit = { requestsPerSecond: 3, maxRetries: 3 };

  constructor(private cache: CacheStore) {}

  async searchGene(query: string, organism?: string, limit = 10): Promise<GeneResult[]> {
    const params = { db: 'gene', term: query, retmax: String(limit), retmode: 'json' };
    const data = await this.request<EsearchResponse>('/esearch.fcgi', params);

    // Second call: fetch summaries
    const ids = data.esearchresult.idlist;
    const summaries = await this.request<EsummaryResponse>('/esummary.fcgi', {
      db: 'gene', id: ids.join(','), retmode: 'json',
    });

    return parseGeneSummaries(summaries);
  }

  private async request<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    const cacheKey = `${endpoint}?${new URLSearchParams(params)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached as T;

    // Rate limit + retry logic
    const response = await withRetry(() => fetch(`${this.baseUrl}${endpoint}?${new URLSearchParams(params)}`));

    const data = await response.json();
    await this.cache.set(cacheKey, data, { ttl: getTTLForEndpoint(endpoint) });
    return data;
  }
}
```

---

## 4. Multi-Model Strategy

| Task | Model Criteria | Example |
|------|---------------|---------|
| Planner (problem decomposition) | Strong reasoning, structured output | claude-sonnet-4, gpt-5, gemini-2.5-pro |
| Executor (tool-driving agent) | Good tool calling, fast | gpt-4o-mini, claude-haiku-4, gemini-2.5-flash |
| Aggregator (report synthesis) | Long context, structured output | claude-sonnet-4, gemini-2.5-pro |
| Simple queries (direct tool use) | Fast and cheap | gpt-4o-mini |

Model selection is configurable: users provide credentials for their preferred providers.

---

## 5. Component Interaction Diagram

```
User Prompt
    │
    ▼
BioAgent.prompt()
    │
    ▼
BioReasoningEngine
    ├─1─ PlannerLLM.complete(question, allToolSchemas)
    │       → PlanStep[]
    │
    ├─2─ Executor (loop until all steps done)
    │   ├─ For each ready step:
    │   │   subAgent = new Agent({ tools: filteredTools })
    │   │   subAgent.prompt(step.description)
    │   │   → StepResult (text + tool call logs)
    │   └─ Unlock dependents
    │
    └─3─ AggregatorLLM.complete(allResults, reportTemplate)
            → StructuredReport (Markdown)
```
