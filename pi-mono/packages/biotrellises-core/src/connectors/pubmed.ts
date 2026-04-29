/**
 * PubMed E-utilities connector for biomedical literature search.
 *
 * Uses NcbiConnector internally with db=pubmed pre-configured.
 *
 * @see https://www.ncbi.nlm.nih.gov/books/NBK25499/
 */

import type { CachePolicy } from "../cache/policy.js";
import type { CacheStore } from "../cache/store.js";
import { NcbiConnector, type NcbiSearchResult, type NcbiSummaryDoc } from "./ncbi.js";

/** A PubMed article summary. */
export interface PubmedArticle {
	/** PubMed ID. */
	pmid: string;
	/** Article title. */
	title: string;
	/** Authors list (e.g., "Smith J, Doe A"). */
	authors?: string;
	/** Journal name. */
	journal?: string;
	/** Publication year. */
	year?: string;
	/** Abstract text. */
	abstract?: string;
}

/** Options for PubmedConnector. */
export interface PubmedConnectorOptions {
	/** Optional API key for higher rate limits. */
	apiKey?: string;
	/** Optional cache store. */
	cache?: CacheStore;
	/** Optional cache policy. */
	cachePolicy?: CachePolicy;
}

/** Connector for PubMed literature search via NCBI E-utilities. */
export class PubmedConnector {
	private readonly ncbi: NcbiConnector;

	constructor(options: PubmedConnectorOptions = {}) {
		this.ncbi = new NcbiConnector({
			apiKey: options.apiKey,
			cache: options.cache,
			cachePolicy: options.cachePolicy,
		});
	}

	/**
	 * Search PubMed for articles matching a query.
	 *
	 * @param query - Search query (e.g., "CRISPR therapy").
	 * @param maxResults - Maximum results to return (default 10).
	 * @param dateRange - Optional date filter, e.g., "2020:2024" or "last5years".
	 */
	async search(query: string, maxResults = 10, dateRange?: string): Promise<NcbiSearchResult> {
		let term = query;
		if (dateRange) {
			if (dateRange === "last5years") {
				const year = new Date().getFullYear() - 5;
				term += ` AND ${year}[PDAT]:3000[PDAT]`;
			} else if (/^\d{4}:\d{4}$/.test(dateRange)) {
				term += ` AND ${dateRange}[PDAT]`;
			}
		}
		return this.ncbi.search("pubmed", term, maxResults);
	}

	/**
	 * Fetch article summaries for a list of PMIDs.
	 *
	 * @param pmids - List of PubMed IDs.
	 */
	async fetchSummaries(pmids: string[]): Promise<PubmedArticle[]> {
		if (pmids.length === 0) return [];

		const docs = await this.ncbi.summary("pubmed", pmids);
		return docs.map((doc) => this.parseSummary(doc));
	}

	/** Parse an NCBI summary document into a PubmedArticle. */
	private parseSummary(doc: NcbiSummaryDoc): PubmedArticle {
		const result = doc as Record<string, unknown>;
		return {
			pmid: String(result.uid ?? ""),
			title: String(result.title ?? result.sorttitle ?? "No title available"),
			authors: Array.isArray(result.authors)
				? (result.authors as Array<{ name?: string }>)
						.map((a) => a.name)
						.filter(Boolean)
						.join(", ")
				: String(result.lastauthor ?? ""),
			journal: String(result.fulljournalname ?? result.source ?? ""),
			year: String(result.pubdate ?? "").split(" ")[0],
			abstract: String(result.abstract ?? ""),
		};
	}
}
