/**
 * UniProt REST API connector for protein sequence and annotation queries.
 *
 * @see https://rest.uniprot.org/docs/
 */

import type { CachePolicy } from "../cache/policy.js";
import type { CacheStore } from "../cache/store.js";
import { BaseConnector } from "./base.js";

/** UniProt search result entry. */
export interface UniprotSearchEntry {
	/** Primary accession number. */
	primaryAccession: string;
	/** Protein description. */
	proteinDescription?: {
		recommendedName?: {
			fullName?: { value: string };
		};
	};
	/** Gene names. */
	genes?: Array<{ geneName?: { value: string } }>;
	/** Organism. */
	organism?: { scientificName?: string };
	/** Sequence length. */
	sequence?: { length: number };
}

/** UniProt search response. */
export interface UniprotSearchResult {
	results: UniprotSearchEntry[];
}

/** UniProt protein entry with full details. */
export interface UniprotEntry {
	/** Primary accession. */
	primaryAccession: string;
	/** Protein names. */
	proteinDescription?: {
		recommendedName?: {
			fullName?: { value: string };
		};
		alternativeNames?: Array<{ fullName?: { value: string } }>;
	};
	/** Gene names. */
	genes?: Array<{ geneName?: { value: string } }>;
	/** Organism. */
	organism?: { scientificName?: string };
	/** Sequence info. */
	sequence?: {
		length: number;
		molWeight: number;
		sequence?: string;
	};
	/** Features (domains, regions, etc.). */
	features?: Array<{
		type: string;
		description?: string;
		location?: {
			start?: { position: number };
			end?: { position: number };
		};
	}>;
	/** Comments (function, disease, etc.). */
	comments?: Array<{
		commentType: string;
		texts?: Array<{ value: string }>;
	}>;
}

/** Options for UniprotConnector. */
export interface UniprotConnectorOptions {
	/** Optional cache store. */
	cache?: CacheStore;
	/** Optional cache policy. */
	cachePolicy?: CachePolicy;
}

/** Connector for UniProt REST APIs. */
export class UniprotConnector extends BaseConnector {
	constructor(options: UniprotConnectorOptions = {}) {
		super({
			name: "UniProt",
			baseUrl: "https://rest.uniprot.org",
			rateLimit: { requestsPerSecond: 5, maxRetries: 3 },
			cache: options.cache,
			cachePolicy: options.cachePolicy,
			headers: {
				Accept: "application/json",
			},
		});
	}

	/**
	 * Search UniProtKB for proteins matching a query.
	 *
	 * @param query - Search query (e.g., "gene:TP53 AND organism_id:9606").
	 * @param size - Number of results to return (default 10, max 25).
	 */
	async search(query: string, size = 10): Promise<UniprotSearchResult> {
		const limitedSize = Math.min(size, 25);
		return this.request<UniprotSearchResult>("/uniprotkb/search", {
			query,
			size: limitedSize,
			format: "json",
			fields: "accession,id,gene_names,organism_name,length",
		});
	}

	/**
	 * Retrieve a full UniProt entry by accession number.
	 *
	 * @param accession - UniProt accession (e.g., "P04637").
	 */
	async getEntry(accession: string): Promise<UniprotEntry> {
		return this.request<UniprotEntry>(`/uniprotkb/${accession}`, {
			format: "json",
		});
	}
}
