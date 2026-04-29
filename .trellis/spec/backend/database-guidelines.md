# Cache & Storage Guidelines

> BioTreLlises has no traditional database. This covers the cache layer for external API queries and session persistence.

---

## Cache Layer

### Why cache

NCBI/UniProt/PubMed enforce rate limits (3 req/s unauthenticated, 10 req/s with API key). Caching eliminates duplicate calls and reduces latency.

### Backend

SQLite via `better-sqlite3` — zero-config, no server process. For MVP: JSONL file cache (simpler, no native deps).

### Cache key

```
{cacheKey} = SHA256(normalize(endpoint + params))
```

Normalize: sort query params alphabetically, strip credentials before hashing.

### TTL rules

| Data type | TTL | Rationale |
|-----------|-----|-----------|
| Gene/protein metadata (name, symbol, ID) | 24h | Changes rarely |
| Sequence data (FASTA) | 24h | Immutable |
| Pathway data (KEGG) | 7d | Updates quarterly |
| Literature search results | 1h | New papers published daily |
| Literature abstract text | 24h | Static once published |
| Protein structure (PDB) | 30d | Structural data changes rarely |

### What NOT to cache

- User input / prompts (privacy)
- Generated reports (reproduce from session JSONL instead)
- Error responses (retry on next query)

---

## Session Persistence

Session data uses pi-agent-core's JSONL session files — NOT our cache layer.

- Session files: `~/.pi/agent/sessions/` (pi-agent-core managed)
- Cache file: `~/.biotrellises/cache.db` (ours)

Do NOT mix session data with cache data. Different lifecycles.

---

## Cache API

```typescript
// Connectors use cache internally — callers don't need to know
const result = await ncbiClient.search('gene', 'TP53');
// → cache hit → returns immediately
// → cache miss → fetches → writes cache → returns

// Force refresh
const fresh = await ncbiClient.search('gene', 'TP53', { forceRefresh: true });
```
