# BioTreLlises

An AI-powered bioinformatics research assistant built on [pi-mono](https://github.com/badlogic/pi-mono). Describe biological questions in natural language, and the agent autonomously plans, queries multiple databases, and synthesizes a structured report.

```
User query: "Analyze the role of EGFR mutations in lung cancer,
             including protein domains and drug associations"

  → Planner:    5 sub-problems (sequence + structure + literature + disease + pathway)
  → Executor:   parallel tool calls (gene_search, protein_info, pubmed_search, disease_link, pathway_enrich)
  → Aggregator: structured report with evidence, sources, and confidence assessment
```

## What This Is (and Isn't)

**This is**: an agent framework that orchestrates multi-database bioinformatics queries. It has real connectors to NCBI, UniProt, PubMed, ClinVar, and KEGG. The LLM reasons about what to query, calls the right tools, and synthesizes results.

**This is not**: a biology knowledge base, a ChatGPT wrapper for bio questions, or a replacement for professional bioinformatics pipelines. The value is in the **orchestration** — the agent holds 5 tool categories across 5 databases, decides what to use, and cross-references findings.

## Features

| Tool | Data Source | Category | Description |
|------|------------|----------|-------------|
| `gene_search` | NCBI Gene | sequence | Gene metadata, genomic location, function |
| `protein_info` | UniProt | structure | Protein domains, molecular weight, function |
| `pubmed_search` | PubMed | literature | Biomedical literature with abstracts |
| `disease_link` | ClinVar | disease | Disease-associated variants, clinical significance |
| `pathway_enrich` | KEGG | pathway | Pathway enrichment analysis for gene sets |

- **LLM-driven reasoning**: Planner decomposes queries → Executor runs tools in parallel → Aggregator synthesizes reports
- **Fallback strategies**: KeywordPlanner and SimpleAggregator run when LLM is unavailable
- **Persistent caching**: JSONL-backed file cache (`BIOTRELLISES_FILE_CACHE=1`), 7-day TTL for pathway data, 24h for gene/protein
- **Multi-model strategy**: different LLM roles route to different models (planner→reasoning, executor→fast)
- **Terminal UI**: rich interactive TUI with markdown rendering, real-time tool execution status
- **Session reproducibility**: all analysis steps recorded for audit and replay

## Quick Start

### Prerequisites

- Node.js >= 20
- An LLM API key (OpenAI, DeepSeek, Anthropic, or 20+ other providers supported by pi-ai)

### CLI

```bash
npm install @mariozechner/biotrellises-core

# Set up API access
export OPENAI_API_KEY="sk-..."

# Optional: enable persistent cache
export BIOTRELLISES_FILE_CACHE=1

# Optional: higher NCBI rate limits
export NCBI_API_KEY="your-key"

# Run
npx biotrellises
```

### Library

```typescript
import {
  BioAgent, DefaultBioToolRegistry, DefaultCachePolicy,
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
const policy = new DefaultCachePolicy();

// Connectors
const ncbi = new NcbiConnector({ cache, cachePolicy: policy });
const uniprot = new UniprotConnector({ cache, cachePolicy: policy });
const pubmed = new PubmedConnector({ cache, cachePolicy: policy });
const clinvar = new ClinvarConnector({ cache, cachePolicy: policy });
const kegg = new KeggConnector({ cache, cachePolicy: policy });

// Tool registry
const registry = new DefaultBioToolRegistry();
registry.register(createGeneSearchTool(ncbi));
registry.register(createProteinInfoTool(uniprot));
registry.register(createPubMedSearchTool(pubmed));
registry.register(createDiseaseLinkTool(clinvar));
registry.register(createPathwayEnrichTool(kegg));

// Agent
const agent = new BioAgent({ registry, initialState: { thinkingLevel: "medium" } });

// Reasoning pipeline
const pipeline = {
  planner: new LLMPlanner(agent),
  executor: new DefaultExecutor(),
  aggregator: new LLMAggregator(agent),
  registry,
};

// TUI
const app = new BioTuiApp({ agent, pipeline });
app.start();
```

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    USER QUERY                         │
└─────────────────────┬────────────────────────────────┘
                      ▼
┌──────────────────────────────────────────────────────┐
│              REASONING ENGINE                         │
│                                                      │
│  Planner ──→ SubProblems ──→ Executor ──→ Results    │
│  (decompose)   [sp-1..sp-N]  (parallel)    per-SP    │
│                                      │               │
│                                      ▼               │
│                              Aggregator ──→ Report    │
└──────────────────────────────────────────────────────┘
                      │ tool calls
                      ▼
┌──────────────────────────────────────────────────────┐
│              TOOL REGISTRY                            │
│  gene_search │ protein_info │ pubmed_search           │
│  disease_link │ pathway_enrich                        │
└───────────────┬──────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│           DATA CONNECTORS                             │
│  NCBI │ UniProt │ PubMed │ ClinVar │ KEGG             │
│           ↕ Cache Layer (Memory / JSONL)              │
└──────────────────────────────────────────────────────┘
```

## Configuration

| Env Variable | Purpose | Default |
|-------------|---------|---------|
| `OPENAI_API_KEY` | LLM API key (or provider-specific env var) | — |
| `NCBI_API_KEY` | Higher NCBI rate limits (10 req/s vs 3) | — |
| `BIOTRELLISES_FILE_CACHE` | `1` to enable JSONL persistent cache | off |

## Cache TTL

| Data Type | TTL |
|-----------|-----|
| Gene/protein metadata | 24h |
| Literature search | 1h |
| Clinical variants | 1h |
| Pathway data | 7d |

## E2E Test Results (DeepSeek-chat)

Planner decomposition quality on 3 biological queries:

| Query | Sub-problems | Tools Used | Quality |
|-------|:-----------:|-----------|:-------:|
| TP53 gene, protein, disease | 3 | sequence, structure, disease | 5/5 |
| BRCA1 pathways + literature | 2 | pathway, literature | 5/5 |
| EGFR lung cancer drug domains | 5 | all 5 tools | 5/5 |

Zero hallucinated categories, zero invalid dependencies. All sub-problems correctly identified as parallel.

## Current State & Limitations

**Strengths**:
- 101 tests passing, zero type errors, zero `any` types
- 5 real database APIs integrated, 5 tool categories implemented
- LLM reasoning verified with DeepSeek and MiMo
- Connectors have retry + rate limiting + caching

**Limitations**:
- Planner quality depends on LLM capability; smaller models may produce worse decompositions
- No web UI — terminal only (pi-web-ui integration planned)
- PDB (protein 3D structure), DrugBank, OMIM connectors not yet built
- Python bridge for BLAST/advanced analysis not implemented
- No real biology benchmark — manual verification only

## Development

```bash
cd pi-mono

# Install
npm install

# Lint + type check
npm run check

# Tests (101 tests, 20 files)
cd packages/biotrellises-core && npx vitest --run

# Run E2E test against your LLM
BIO_API_KEY="sk-..." \
BIO_API_URL="https://api.deepseek.com/v1" \
BIO_MODEL="deepseek-chat" \
node scripts/e2e-bioagent.mjs
```

## License

MIT
