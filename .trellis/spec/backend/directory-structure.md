# Directory Structure

> BioTreLlises core package — Agent runtime, tools, connectors, reasoning engine.

---

## Overview

We extend pi-mono packages (`@mariozechner/pi-ai`, `@mariozechner/pi-agent-core`, `@mariozechner/pi-tui`) rather than forking. Our package lives alongside pi-mono packages in the same monorepo workspace.

---

## Directory Layout

```
packages/biotrellises-core/
├── src/
│   ├── agent/                  # BioAgent — extends pi-agent-core Agent
│   │   ├── bio-agent.ts        # Main agent class
│   │   ├── system-prompt.ts    # Biology domain system prompt
│   │   └── model-strategy.ts   # Multi-model routing logic
│   │
│   ├── tools/                  # BioTool implementations (each = AgentTool)
│   │   ├── gene-search.ts      # NCBI gene/sequence query
│   │   ├── protein-info.ts     # UniProt protein lookup
│   │   ├── pubmed-search.ts    # PubMed literature search
│   │   ├── pathway-enrich.ts   # KEGG pathway enrichment
│   │   ├── blast.ts            # BLAST sequence alignment
│   │   └── disease-link.ts     # ClinVar/OMIM gene-disease association
│   │
│   ├── connectors/             # Thin REST API wrappers (TypeScript fetch)
│   │   ├── ncbi.ts             # NCBI E-utilities client
│   │   ├── uniprot.ts          # UniProt REST client
│   │   ├── pubmed.ts           # PubMed E-utilities client
│   │   ├── kegg.ts             # KEGG REST client
│   │   └── types.ts            # Shared connector types (rate limits, errors)
│   │
│   ├── reasoning/              # Bio Reasoning Engine
│   │   ├── planner.ts          # Problem decomposition (Planner LLM)
│   │   ├── executor.ts         # Sub-problem parallel/serial executor
│   │   └── aggregator.ts       # Result aggregation + report generation
│   │
│   ├── cache/                  # Local query cache
│   │   ├── store.ts            # SQLite / JSONL cache backend
│   │   └── policy.ts           # TTL rules per endpoint
│   │
│   ├── registry.ts             # BioToolRegistry — tool registration + LLM schema gen
│   └── index.ts                # Public API surface
│
├── test/
│   ├── tools/                  # Per-tool unit tests
│   ├── connectors/             # Connector integration tests (with mocks)
│   ├── reasoning/              # Reasoning engine tests (with faux provider)
│   └── e2e/                    # End-to-end scenario tests
│
└── package.json
```

---

## Module Organization

**Rule**: Each connector is independent. Each tool depends on exactly one connector (or is self-contained like BLAST). No cross-tool imports.

**Dependency direction**: `tools/` → `connectors/` → `cache/`. Never reverse.

When adding a new tool:
1. Add connector if new data source (e.g., `connectors/string.ts`)
2. Add tool wrapping the connector (e.g., `tools/string-network.ts`)
3. Register in `registry.ts`
4. Add test in `test/tools/`

---

## Naming Conventions

- Files: kebab-case (`gene-search.ts`, `system-prompt.ts`)
- Classes: PascalCase (`BioAgent`, `BioToolRegistry`)
- Functions: camelCase (`getGeneInfo`, `searchPubMed`)
- Tool names: snake_case per pi-agent-core convention (`gene_search`, `protein_info`)
- Tool parameter types: PascalCase + Params suffix (`GeneSearchParams`, `BlastParams`)

---

## Examples

- Well-organized tool: `packages/biotrellises-core/src/tools/gene-search.ts`
- Well-organized connector: `packages/biotrellises-core/src/connectors/ncbi.ts`
- Registry usage: `packages/biotrellises-core/src/registry.ts`
