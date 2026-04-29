/**
 * NCBI E-utilities connector for gene, sequence, and literature queries.
 *
 * @see https://www.ncbi.nlm.nih.gov/books/NBK25499/
 */

import type { CachePolicy } from "../cache/policy.js";
import type { CacheStore } from "../cache/store.js";
import { BaseConnector } from "./base.js";
import type { RateLimit } from "./types.js";

/** NCBI E-utilities search result. */
export interface NcbiSearchResult {
	/** Database queried. */
	db: string;
	/** List of matching UIDs. */
	ids: string[];
	/** Total count of matches. */
	count: number;
}

/** NCBI E-utilities summary document. */
export interface NcbiSummaryDoc {
	/** Unique identifier. */
	uid: string;
	/** Document title or name. */
	title?: string;
	/** Additional fields vary by database. */
	[key: string]: unknown;
}

/** NCBI E-utilities summary result. */
export interface NcbiSummaryResult {
	/** Documents keyed by UID. */
	result: Record<string, NcbiSummaryDoc | string[]>;
}

/** Options for NcbiConnector. */
export interface NcbiConnectorOptions {
	/** Optional API key for higher rate limits (10 req/s vs 3 req/s). */
	apiKey?: string;
	/** Optional cache store. */
	cache?: CacheStore;
	/** Optional cache policy. */
	cachePolicy?: CachePolicy;
}

/** Connector for NCBI E-utilities APIs. */
export class NcbiConnector extends BaseConnector {
	readonly apiKey?: string;

	constructor(options: NcbiConnectorOptions = {}) {
		const rateLimit: RateLimit = {
			requestsPerSecond: options.apiKey ? 10 : 3,
			maxRetries: 3,
		};
		super({
			name: "NCBI E-utilities",
			baseUrl: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
			rateLimit,
			cache: options.cache,
			cachePolicy: options.cachePolicy,
		});
		this.apiKey = options.apiKey;
	}

	/**
	 * Search an NCBI database and return matching IDs.
	 *
	 * @param db - Database name (e.g., "gene", "nuccore", "pubmed").
	 * @param term - Search term.
	 * @param retmax - Maximum results to return (default 20).
	 */
	async search(db: string, term: string, retmax = 20): Promise<NcbiSearchResult> {
		const params: Record<string, unknown> = {
			db,
			term,
			retmax,
			retmode: "json",
		};
		if (this.apiKey) params.api_key = this.apiKey;

		const data = await this.request<{
			esearchresult?: {
				idlist?: string[];
				count?: string;
			};
		}>("esearch.fcgi", params);

		const idlist = data.esearchresult?.idlist ?? [];
		const count = Number(data.esearchresult?.count ?? idlist.length);

		return { db, ids: idlist, count };
	}

	/**
	 * Fetch document summaries for a list of IDs.
	 *
	 * @param db - Database name.
	 * @param ids - List of UIDs.
	 */
	async summary(db: string, ids: string[]): Promise<NcbiSummaryDoc[]> {
		if (ids.length === 0) return [];

		const params: Record<string, unknown> = {
			db,
			id: ids.join(","),
			retmode: "json",
		};
		if (this.apiKey) params.api_key = this.apiKey;

		const data = await this.request<NcbiSummaryResult>("esummary.fcgi", params);

		const result = data.result ?? {};
		// Use the "uids" array to preserve order; fallback to Object.entries if missing
		const uids = Array.isArray(result.uids) ? (result.uids as string[]) : [];
		const docs: NcbiSummaryDoc[] = [];
		for (const uid of uids) {
			const doc = result[uid];
			if (typeof doc === "object" && doc !== null && !Array.isArray(doc)) {
				docs.push(doc as NcbiSummaryDoc);
			}
		}
		return docs;
	}

	/**
	 * Fetch full records for a list of IDs.
	 * Returns raw text (XML or other format depending on rettype).
	 *
	 * @param db - Database name.
	 * @param ids - List of UIDs.
	 * @param rettype - Return type (e.g., "gb" for GenBank, "fasta" for FASTA).
	 * @param retmode - Return mode (e.g., "xml", "text", "json").
	 */
	async fetchRecords(db: string, ids: string[], rettype?: string, retmode = "xml"): Promise<string> {
		if (ids.length === 0) return "";

		const params: Record<string, unknown> = {
			db,
			id: ids.join(","),
			retmode,
		};
		if (rettype) params.rettype = rettype;
		if (this.apiKey) params.api_key = this.apiKey;

		return this.requestText("efetch.fcgi", params);
	}
}
