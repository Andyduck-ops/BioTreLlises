/**
 * ClinVar E-utilities connector for disease-variant association queries.
 *
 * Wraps NcbiConnector internally with db=clinvar pre-configured.
 * Follows the same pattern as PubmedConnector.
 *
 * @see https://www.ncbi.nlm.nih.gov/books/NBK25499/
 */

import type { CachePolicy } from "../cache/policy.js";
import type { CacheStore } from "../cache/store.js";
import { NcbiConnector, type NcbiSearchResult, type NcbiSummaryDoc } from "./ncbi.js";

/** A ClinVar variant entry with clinical significance. */
export interface ClinvarVariant {
	/** ClinVar variation ID. */
	variationId: string;
	/** Associated gene symbol. */
	geneSymbol?: string;
	/** Clinical significance (e.g., "Pathogenic", "Likely pathogenic", "Uncertain significance"). */
	clinicalSignificance?: string;
	/** Associated condition or phenotype. */
	condition?: string;
	/** Review status (e.g., "criteria provided, multiple submitters, no conflicts"). */
	reviewStatus?: string;
}

/** Options for ClinvarConnector. */
export interface ClinvarConnectorOptions {
	/** Optional API key for higher rate limits. */
	apiKey?: string;
	/** Optional cache store. */
	cache?: CacheStore;
	/** Optional cache policy. */
	cachePolicy?: CachePolicy;
}

/** Connector for ClinVar disease-variant queries via NCBI E-utilities. */
export class ClinvarConnector {
	private readonly ncbi: NcbiConnector;

	constructor(options: ClinvarConnectorOptions = {}) {
		this.ncbi = new NcbiConnector({
			apiKey: options.apiKey,
			cache: options.cache,
			cachePolicy: options.cachePolicy,
		});
	}

	/**
	 * Search ClinVar for variants matching a gene symbol or disease name.
	 *
	 * @param query - Gene symbol (e.g., "BRCA1") or condition name.
	 * @param maxResults - Maximum results to return (default 10).
	 */
	async search(query: string, maxResults = 10): Promise<NcbiSearchResult> {
		const term = `${query}[Gene Name] OR ${query}[Title]`;
		return this.ncbi.search("clinvar", term, maxResults);
	}

	/**
	 * Fetch detailed variant records for a list of ClinVar variation IDs.
	 *
	 * @param ids - List of ClinVar variation IDs.
	 */
	async fetchDetails(ids: string[]): Promise<ClinvarVariant[]> {
		if (ids.length === 0) return [];

		const docs = await this.ncbi.summary("clinvar", ids);
		return docs.map((doc) => this.parseVariant(doc));
	}

	/** Parse an NCBI summary document into a ClinvarVariant. */
	private parseVariant(doc: NcbiSummaryDoc): ClinvarVariant {
		const result = doc as Record<string, unknown>;
		return {
			variationId: String(result.uid ?? ""),
			geneSymbol: typeof result.gene_sort === "string" && result.gene_sort.length > 0 ? result.gene_sort : undefined,
			clinicalSignificance:
				typeof result.clinical_significance === "string" ? result.clinical_significance : undefined,
			condition: typeof result.title === "string" ? this.extractCondition(result.title) : undefined,
			reviewStatus: typeof result.review_status === "string" ? result.review_status : undefined,
		};
	}

	/** Extract condition name from the variant title. */
	private extractCondition(title: string): string | undefined {
		const match = title.match(/\(([^)]+)\)/);
		return match ? match[1] : title;
	}
}
