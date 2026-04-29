# BioTreLlises

**AI-powered bioinformatics research agent** — an autonomous LLM agent that reasons across five public biological databases, decomposes complex queries, executes multi-source retrieval in parallel, and synthesizes structured reports with cross-source consistency validation.

---

## Motivation

Biological data is fragmented across siloed databases — NCBI for genes, UniProt for proteins, ClinVar for variants, PubMed for literature, KEGG for pathways. A single research question often requires querying 3–5 of them, manually cross-referencing results, and reconciling contradictions.

BioTreLlises automates this workflow end-to-end:

- **Planner** (LLM) decomposes a natural-language question into independent sub-problems
- **Executor** dispatches parallel tool calls to the relevant databases
- **Aggregator** (LLM) synthesizes findings and **cross-validates** claims across sources

The result: a researcher can ask *"What is the role of EGFR mutations in lung cancer, including protein domain changes and known drug associations?"* and get a report backed by gene records, protein structures, clinical variants, pathway data, and literature — in one invocation.

---

## Architecture

```
USER QUERY
    │
    ▼
┌─────────────────────────────────────────┐
│          REASONING PIPELINE              │
│                                         │
│  Planner ──→ SubProblems ──→ Executor   │
│  (decompose)  [sp-1..sp-N]   (parallel) │
│                                   │     │
│                                   ▼     │
│                           Aggregator    │
│                        (+ consistency)  │
└──────────┬──────────────────────────────┘
           │ tool calls
           ▼
┌─────────────────────────────────────────┐
│           TOOL REGISTRY                  │
│  gene_search   protein_info             │
│  pubmed_search disease_link             │
│  pathway_enrich                         │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│        DATA CONNECTORS                   │
│  NCBI Gene  UniProt  PubMed             │
│  ClinVar    KEGG                         │
│       ↕ Cache (Memory / JSONL File)      │
└─────────────────────────────────────────┘
```

---

## Drug Discovery Use Case

Below is an actual end-to-end Planner decomposition for a drug-target question, running on DeepSeek-chat:

**Query**: *"Analyze the role of EGFR mutations in lung cancer, including protein domains and drug associations"*

**Planner output** (5 sub-problems, all parallel):

| Sub-Problem | Tool Category | Goal |
|-------------|:---:|------|
| sp-1 | sequence | Identify EGFR gene and its mutations associated with lung cancer |
| sp-2 | structure | Retrieve protein domains and functional information for EGFR |
| sp-3 | literature | Find literature on EGFR mutations in lung cancer and drug associations |
| sp-4 | disease | Identify disease-associated EGFR variants in lung cancer from ClinVar |
| sp-5 | pathway | Find KEGG pathways related to EGFR and lung cancer drug targets |

**Aggregator report** — see [example output](#aggregator-cross-validation-example).

This decomposition is **zero hallucination**: all five tool categories are valid, dependencies correctly identified as parallel (none depend on each other's output).

---

## Data Sources & Tools

| Tool | Source | Category | What it returns |
|------|--------|:---:|------|
| `gene_search` | [NCBI Gene](https://www.ncbi.nlm.nih.gov/gene) | sequence | Symbol, full name, genomic location, functional summary |
| `protein_info` | [UniProt](https://www.uniprot.org) | structure | Domains with residue ranges, molecular weight, function |
| `pubmed_search` | [PubMed](https://pubmed.ncbi.nlm.nih.gov) | literature | Titles, authors, journals, PMIDs, abstracts |
| `disease_link` | [ClinVar](https://www.ncbi.nlm.nih.gov/clinvar) | disease | Variant ID, clinical significance, associated conditions |
| `pathway_enrich` | [KEGG](https://www.genome.jp/kegg) | pathway | Enriched pathways ranked by gene count, pathway IDs |

---

## Planner Benchmark

A 10-query benchmark evaluates decomposition quality across all five tool categories, multi-category queries, and Chinese-language queries. **Run on DeepSeek-chat (2026-04-29)**:

```bash
BIO_API_KEY="sk-xxx" \
BIO_API_URL="https://api.deepseek.com/v1" \
BIO_MODEL="deepseek-chat" \
node scripts/benchmark-planner.mjs
```

### Results

| Query | Expected Categories | Sub-Problems | Grade |
|-------|---------------------|:---:|:---:|
| *Find the genomic location and function of the TP53 gene* | sequence | 2 | ✓ PASS (1.00) |
| *What are the protein domains of BRCA1?* | structure | 2 | ✓ PASS (1.00) |
| *Search for recent publications about CRISPR-Cas9 gene therapy* | literature | 1 | ✓ PASS (1.00) |
| *What disease-associated variants are found in the CFTR gene?* | disease | 2 | ✓ PASS (1.00) |
| *Analyze pathway enrichment for EGFR, KRAS, BRAF in colorectal cancer* | pathway | 4 | ~ WEAK (0.67) |
| *Analyze EGFR mutations in lung cancer, protein domains & drug associations* | sequence, structure, disease, literature | 4 | ✓ PASS (0.92) |
| *Investigate BRCA1: gene location, protein structure, diseases, publications* | sequence, structure, disease, literature | 4 | ✓ PASS (1.00) |
| *TP53基因的功能、相关疾病和最新研究进展* | sequence, disease, literature | 5 | ✓ PASS (0.83) |
| *BRCA1和BRCA2基因的蛋白质结构、疾病通路及临床变异* | structure, pathway, disease | 3 | ✓ PASS (1.00) |
| *分析EGFR基因在肺癌中的作用：蛋白结构域、信号通路、靶向药物文献* | sequence, structure, pathway, literature | 5 | ✓ PASS (1.00) |

### Aggregate Metrics

| Metric | Score | Notes |
|--------|:---:|------|
| **Category accuracy** | 1.000 | Zero hallucinated categories; all sub-problems mapped to valid tools |
| **Count match** | 0.850 | 1 case where Planner over-decomposed (relative to ground truth) |
| **Dependency correctness** | 1.000 | All sub-problems correctly identified as parallel (no false dependencies) |
| **Overall** | **0.950** | 9/10 PASS (≥0.8), 1 WEAK (0.5–0.8), 0 FAIL |

### Aggregator Cross-Validation Example

The Aggregator performs cross-source consistency checking. Below is an actual LLM-generated report for *"Analyze the TP53 gene, its protein structure, and associated literature"*:

```json
{
  "summary": "TP53 is a critical tumor suppressor gene at 17p13.1, encoding p53 (P04637, 393 aa, 43.7 kDa) with a DNA-binding domain at residues 102-292.",
  "findings": [
    "TP53 is located at chromosome 17p13.1 and functions as a tumor suppressor",
    "p53 protein is 393 amino acids with DNA-binding domain (102-292)",
    "PubMed has 180,000+ publications, primarily in cancer biology and apoptosis"
  ],
  "confidence": "high",
  "consistency": {
    "conflicts": [],
    "agreements": [
      "All sources consistently identify TP53 as a tumor suppressor gene",
      "Protein details (length, weight, domain) align with standard p53 knowledge",
      "Literature count and focus are consistent with the gene's importance in cancer"
    ]
  }
}
```

No contradictory claims were found across the three data sources (NCBI Gene, UniProt, PubMed). This demonstrates the value of multi-source cross-referencing in reducing single-source bias.

---

## Quick Start

### Prerequisites

- **Node.js** >= 20
- **An LLM API key** — any OpenAI-compatible provider (DeepSeek, OpenAI, MiMo, etc.)

### CLI

```bash
npm install @mariozechner/biotrellises-core

# Built-in model (from pi-ai registry)
npx biotrellises --model claude-sonnet-4-6

# Custom OpenAI-compatible API
npx biotrellises -m deepseek-chat -u https://api.deepseek.com/v1 -k sk-xxx

# Enable persistent cache (survives restarts)
export BIOTRELLISES_FILE_CACHE=1

# Higher NCBI rate limits (10 req/s)
export NCBI_API_KEY="your-key"
```

### Programmatic

```typescript
import {
  BioAgent, DefaultBioToolRegistry,
  NcbiConnector, UniprotConnector, PubmedConnector,
  ClinvarConnector, KeggConnector,
  createGeneSearchTool, createProteinInfoTool, createPubMedSearchTool,
  createDiseaseLinkTool, createPathwayEnrichTool,
  LLMPlanner, DefaultExecutor, LLMAggregator,
  BioTuiApp,
} from "@mariozechner/biotrellises-core";

const cache = new MemoryCacheStore(); // or FileCacheStore

const ncbi    = new NcbiConnector({ cache });
const uniprot = new UniprotConnector({ cache });
const pubmed  = new PubmedConnector({ cache });
const clinvar = new ClinvarConnector({ cache });
const kegg    = new KeggConnector({ cache });

const registry = new DefaultBioToolRegistry();
registry.register(createGeneSearchTool(ncbi));
registry.register(createProteinInfoTool(uniprot));
registry.register(createPubMedSearchTool(pubmed));
registry.register(createDiseaseLinkTool(clinvar));
registry.register(createPathwayEnrichTool(kegg));

const agent = new BioAgent({ registry, initialState: { thinkingLevel: "medium" } });

const pipeline = {
  planner:    new LLMPlanner(agent),
  executor:   new DefaultExecutor(),
  aggregator: new LLMAggregator(agent),
  registry,
};

const app = new BioTuiApp({ agent, pipeline });
app.start();
```

---

## LLM Configuration

Built on [pi-ai](https://github.com/badlogic/pi-mono) — a unified LLM abstraction supporting 20+ providers.

### Built-in models

```bash
biotrellises --model claude-sonnet-4-6
biotrellises --model gpt-4o
biotrellises --model gemini-2.5-pro
```

### Custom OpenAI-compatible APIs

| Flag | Env Var | Example |
|------|---------|---------|
| `-m, --model-id` | `BIO_MODEL` | `deepseek-chat` |
| `-u, --api-url` | `BIO_API_URL` | `https://api.deepseek.com/v1` |
| `-k, --api-key` | `BIO_API_KEY` | `sk-xxx` |

---

## Multi-Model Strategy

Different agent roles target different model profiles:

| Role | Priority | Task |
|------|----------|------|
| **Planner** | Strong reasoning, structured JSON output | Query decomposition |
| **Executor** | Fast, reliable tool calling | Parallel tool dispatch |
| **Aggregator** | Long context (200K+), synthesis | Report generation + cross-validation |

---

## Cache Policy

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Gene / protein metadata | 24h | NCBI/UniProt update daily |
| Literature search | 1h | PubMeb indexing latency |
| Clinical variants | 1h | ClinVar submissions ongoing |
| Pathway data | 7d | KEGG releases quarterly |

---

## Development

```bash
cd pi-mono
npm install

# Type check (zero errors)
npx tsgo --noEmit

# Unit tests (102 tests, 20 files)
cd packages/biotrellises-core
npx vitest --run

# E2E test against real LLM
cd ../..
BIO_API_KEY="sk-xxx" \
BIO_API_URL="https://api.deepseek.com/v1" \
BIO_MODEL="deepseek-chat" \
node scripts/e2e-bioagent.mjs

# Planner benchmark (10 queries)
node scripts/benchmark-planner.mjs
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Agent runtime | [pi-agent-core](https://github.com/badlogic/pi-mono) — state machine, tool dispatch, sub-agent spawning |
| LLM abstraction | [pi-ai](https://github.com/badlogic/pi-mono) — 20+ providers, unified Model interface |
| Terminal UI | [pi-tui](https://github.com/badlogic/pi-mono) — Ink/React-based, markdown rendering |
| Tool schemas | [TypeBox](https://github.com/sinclairzx81/typebox) — runtime type validation |
| HTTP client | Native `fetch` with retry + rate limiting |
| Cache | In-memory Map / JSONL file append-only persistence |
| Testing | Vitest + nock (HTTP mocking) |
| Language | TypeScript (strict), Node.js ESM |

---

## Project Status

- **102 tests** passing, 20 test files
- **0 type errors** (`tsgo --noEmit`)
- All 5 database connectors verified against real APIs
- LLM reasoning validated with DeepSeek-chat and MiMo-v2.5-pro
- Planner: 0.95 benchmark score, zero hallucinated categories

## Limitations & Roadmap

| Area | Current | Planned |
|------|---------|---------|
| Databases | NCBI, UniProt, PubMed, ClinVar, KEGG | PDB (3D structure), DrugBank, OMIM |
| UI | Terminal (TUI) | Web UI via pi-web-ui |
| Analysis | Retrieval + synthesis | Python bridge for BLAST, molecular docking |
| Benchmark | Planner only | Executor tool-selection, Aggregator quality |
| CI/CD | Manual testing | GitHub Actions for tests + type check |

---

## License

MIT
