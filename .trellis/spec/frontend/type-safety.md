# Type Safety

> TypeScript conventions for BioTreLlises — TypeBox schemas, strict mode, no escape hatches.

---

## Overview

- TypeScript 5.x, strict mode enabled
- TypeBox for all runtime-validated schemas (tool parameters)
- No `any`, no type assertions (`as`) unless provably safe
- Types are source of truth for tool interfaces

---

## Type Organization

```
packages/biotrellises-core/src/
├── types/                    # Shared BioTreLlises types
│   ├── bio.ts                # Gene, Protein, Pathway, Literature types
│   ├── analysis.ts           # AnalysisResult, Report types
│   └── events.ts             # Custom event payloads (declaration merge)
│
├── connectors/types.ts       # Connector-specific types (API request/response)
└── tools/*.ts                # Tool-specific Param types (TypeBox schemas)
```

---

## TypeBox for Validation

TypeBox schemas are the runtime validator. Pi-agent-core's `validateToolCall` uses them:

```typescript
import { Type, Static } from '@mariozechner/pi-ai';

// Define schema
const GeneSearchParams = Type.Object({
  query: Type.String({ minLength: 1, description: 'Gene symbol, name, or ID' }),
  organism: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 10 })),
});

// Extract static type (no duplication!)
type GeneSearchParams = Static<typeof GeneSearchParams>;

// Use in tool
const tool: AgentTool = {
  name: 'gene_search',
  parameters: GeneSearchParams,  // ← TypeBox schema = single source of truth
  execute: async (id, params) => {
    // params is typed as GeneSearchParams automatically
    const { query, organism, limit } = params;
  },
};
```

Never write both a TypeBox schema AND a TypeScript interface for the same thing.

---

## Declaration Merging for Custom Events

```typescript
// In types/events.ts
declare module '@mariozechner/pi-agent-core' {
  interface CustomAgentEvents {
    reasoning_plan: {
      type: 'reasoning_plan';
      planSteps: PlanStep[];
      estimatedTools: string[];
    };
    aggregation_complete: {
      type: 'aggregation_complete';
      sectionCount: number;
      uncertaintyFlags: string[];
    };
  }
}
```

---

## Forbidden Patterns

| Pattern | Reason | Fix |
|---------|--------|-----|
| `any` | Bypasses all type checking | Find correct type or use `unknown` + narrowing |
| `as Type` assertion | You're lying to the compiler | Use type guards |
| `// @ts-ignore` | Hides real problems | Fix the type error |
| Duplicate schema + interface | Drift risk | TypeBox Static<T> |
