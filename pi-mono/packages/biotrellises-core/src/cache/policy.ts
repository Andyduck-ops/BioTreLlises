/**
 * Cache TTL policies for bioinformatics endpoints.
 */

/** Interface for endpoint-specific cache policies. */
export interface CachePolicy {
	/**
	 * Determine the TTL (in seconds) for a given endpoint.
	 * @param endpoint - API endpoint path or identifier.
	 * @returns TTL in seconds.
	 */
	getTTL(endpoint: string): number;
}

/** Default cache policy with endpoint-specific TTLs. */
export class DefaultCachePolicy implements CachePolicy {
	/**
	 * Return a TTL based on the endpoint type.
	 * - NCBI E-utilities (esearch, esummary, efetch) → 24h
	 * - UniProt → 24h
	 * - PubMed → 1h
	 * - Everything else → 1h
	 */
	getTTL(endpoint: string): number {
		const lower = endpoint.toLowerCase();

		if (lower.includes("/esearch") || lower.includes("/esummary") || lower.includes("/efetch")) {
			return 86_400; // 24 hours
		}

		if (lower.includes("uniprot")) {
			return 86_400; // 24 hours
		}

		if (lower.includes("pubmed") || lower.includes("clinvar")) {
			return 3_600; // 1 hour — literature and variant data
		}

		if (lower.includes("kegg") || lower.includes("/list/pathway") || lower.includes("/link/pathway")) {
			return 604_800; // 7 days — pathway data updates quarterly
		}

		return 3_600; // default 1 hour
	}
}
