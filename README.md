# BioTreLlises

AI-powered bioinformatics research agent. Describe biological questions in natural language, and the agent autonomously plans, queries multiple databases, and synthesizes a structured report with cross-source consistency validation.

```
User: "Analyze EGFR mutations in lung cancer, including protein domains and drug associations"

  Planner    →  5 sub-problems (sequence + structure + literature + disease + pathway)
  Executor   →  parallel tool execution across 5 databases
  Aggregator →  structured report with evidence, sources, and consistency check
```

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    USER QUERY                         │
└─────────────────────┬────────────────────────────────┘
                      ▼
┌──────────────────────────────────────────────────────┐
│              REASONING PIPELINE                        │
│                                                      │
│  Planner ──→ SubProblems ──→ Executor ──→ Results    │
│  (decompose)   [sp-1..sp-N]  (parallel)    per-SP    │
│                                      │               │
│                                      ▼               │
│                              Aggregator ──→ Report    │
│                              (+ cross-validation)    │
└──────────────────────────────────────────────────────┘
                      │ tool calls
                      ▼
┌──────────────────────────────────────────────────────┐
│              TOOL REGISTRY                             │
│  gene_search │ protein_info │ pubmed_search           │
│  disease_link │ pathway_enrich                        │
└───────────────┬──────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│           DATA CONNECTORS                             │
│  NCBI │ UniProt │ PubMed │ ClinVar │ KEGG             │
│           ↕ Cache Layer (Memory / JSONL File)         │
└──────────────────────────────────────────────────────┘
```

## Data Sources & Tools

| Tool | Source | Category | Description |
|------|--------|----------|-------------|
| `gene_search` | NCBI Gene | sequence | Gene metadata, genomic location, function |
| `protein_info` | UniProt | structure | Protein domains, molecular weight, function |
| `pubmed_search` | PubMed | literature | Biomedical literature with abstracts |
| `disease_link` | ClinVar | disease | Disease-associated variants, clinical significance |
| `pathway_enrich` | KEGG | pathway | Pathway enrichment analysis for gene sets |

## Quick Start

### Prerequisites

- Node.js >= 20
- An LLM API key (OpenAI, DeepSeek, or any OpenAI-compatible provider)

### CLI

```bash
# Install
npm install @mariozechner/biotrellises-core

# Using a built-in model
npx biotrellises --model claude-sonnet-4-6

# Using a custom OpenAI-compatible API (DeepSeek, MiMo, etc.)
npx biotrellises -m deepseek-chat -u https://api.deepseek.com/v1 -k sk-xxx

# Optional: enable persistent file cache (survives restarts)
export BIOTRELLISES_FILE_CACHE=1

# Optional: higher NCBI rate limits
export NCBI_API_KEY="your-key"
```

### Programmatic Usage

```typescript
import {
  BioAgent, DefaultBioToolRegistry,
  NcbiConnector, UniprotConnector, PubmedConnector,
  ClinvarConnector, KeggConnector,
  FileCacheStore, MemoryCacheStore,
  createGeneSearchTool, createProteinInfoTool, createPubMedSearchTool,
  createDiseaseLinkTool, createPathwayEnrichTool,
  LLMPlanner, DefaultExecutor, LLMAggregator,
  BioTuiApp,
} from "@mariozechner/biotrellises-core";

// Shared cache
const cache = new MemoryCacheStore();
// Or: new FileCacheStore() for persistent JSONL storage

// Connectors
const ncbi    = new NcbiConnector({ cache });
const uniprot = new UniprotConnector({ cache });
const pubmed  = new PubmedConnector({ cache });
const clinvar = new ClinvarConnector({ cache });
const kegg    = new KeggConnector({ cache });

// Tool registry
const registry = new DefaultBioToolRegistry();
registry.register(createGeneSearchTool(ncbi));
registry.register(createProteinInfoTool(uniprot));
registry.register(createPubMedSearchTool(pubmed));
registry.register(createDiseaseLinkTool(clinvar));
registry.register(createPathwayEnrichTool(kegg));

// Agent with custom model
const agent = new BioAgent({
  registry,
  initialState: {
    thinkingLevel: "medium",
    model: { id: "deepseek-chat", api: "openai-completions", provider: "openai", ... },
  },
});

// Reasoning pipeline
const pipeline = {
  planner: new LLMPlanner(agent),
  executor: new DefaultExecutor(),
  aggregator: new LLMAggregator(agent),
  registry,
};

// Launch TUI
const app = new BioTuiApp({ agent, pipeline });
app.start();
```

## LLM Configuration

BioTreLlises uses [pi-ai](https://github.com/badlogic/pi-mono) for unified multi-model access.

**Built-in models** — use `--model` to select from the registry:
```bash
biotrellises --model claude-sonnet-4-6
biotrellises --model gpt-4o
```

**Custom OpenAI-compatible APIs** — pass flags or set env vars:

| Flag | Env Var | Description |
|------|---------|-------------|
| `-m, --model-id` | `BIO_MODEL` | Model ID (e.g. `deepseek-chat`, `mimo-v2.5-pro`) |
| `-u, --api-url` | `BIO_API_URL` | API base URL |
| `-k, --api-key` | `BIO_API_KEY` | API key |

## Multi-Model Strategy

Different agent roles route to different models for optimal performance:

| Role | Requirements | Strategy |
|------|-------------|----------|
| Planner | Strong reasoning, structured output | Prefers reasoning models |
| Executor | Fast tool calling | Routes to fast models |
| Aggregator | Long context, cross-source synthesis | Prefers high-context models |

## Cache TTL

| Data Type | TTL | Notes |
|-----------|-----|-------|
| Gene/protein metadata | 24h | NCBI, UniProt |
| Literature search | 1h | PubMed results |
| Clinical variants | 1h | ClinVar |
| Pathway data | 7d | KEGG updates quarterly |

## Benchmark

A 10-query Planner benchmark is included to evaluate decomposition quality:

```bash
BIO_API_KEY="sk-xxx" \
BIO_API_URL="https://api.deepseek.com/v1" \
BIO_MODEL="deepseek-chat" \
node scripts/benchmark-planner.mjs
```

| Metric | Value |
|--------|-------|
| Category accuracy | 1.000 |
| Dependency correctness | 1.000 |
| Overall | 0.950 |

Covers all 5 tool categories, multi-category queries, and Chinese-language queries.

## Development

```bash
cd pi-mono

# Install
npm install

# Type check
npx tsgo --noEmit

# Tests (102 tests, 20 files)
cd packages/biotrellises-core
npx vitest --run

# Full E2E test (against real LLM)
cd ../..
BIO_API_KEY="sk-xxx" \
BIO_API_URL="https://api.deepseek.com/v1" \
BIO_MODEL="deepseek-chat" \
node scripts/e2e-bioagent.mjs
```

## Key Features

- **LLM-driven reasoning**: Planner decomposes queries → Executor runs tools in parallel → Aggregator synthesizes reports with cross-source consistency validation
- **Fallback strategies**: KeywordPlanner and SimpleAggregator run when LLM is unavailable
- **Persistent caching**: JSONL file cache (`BIOTRELLISES_FILE_CACHE=1`), 7-day TTL for pathway data
- **Multi-model routing**: Different LLM roles route to different models based on task requirements
- **Terminal UI**: Rich interactive TUI with markdown rendering and real-time tool execution status
- **Custom LLM support**: Any OpenAI-compatible API via CLI flags
- **Session reproducibility**: All analysis steps recorded for audit and replay

## Limitations

- Planner quality depends on LLM capability; smaller models may produce worse decompositions
- Terminal UI only — no web interface
- PDB (protein 3D structure), DrugBank, OMIM connectors not yet built
- Python bridge for BLAST/advanced analysis not implemented

## License

MIT
