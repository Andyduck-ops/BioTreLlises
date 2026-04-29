/**
 * KEGG REST API connector for pathway and gene queries.
 *
 * KEGG returns text/plain (TSV or formatted text), not JSON.
 * All methods use requestText() — BaseConnector's raw text fetcher.
 *
 * @see https://www.kegg.jp/kegg/rest/keggapi.html
 */

import type { CachePolicy } from "../cache/policy.js";
import type { CacheStore } from "../cache/store.js";
import { BaseConnector } from "./base.js";
import type { RateLimit } from "./types.js";

/** A KEGG pathway listing entry. */
export interface KeggPathwayEntry {
	/** Pathway identifier (e.g., "path:hsa00010"). */
	entryId: string;
	/** Human-readable pathway name. */
	name: string;
}

/** A gene entry within a KEGG pathway. */
export interface KeggPathwayGene {
	/** KEGG gene ID (e.g., "hsa:7157"). */
	geneId: string;
	/** Gene name or description from KEGG. */
	name: string;
}

/** A KEGG pathway with its full gene list. */
export interface KeggPathway {
	/** Pathway identifier. */
	id: string;
	/** Pathway name. */
	name: string;
	/** Genes annotated to this pathway. */
	genes: KeggPathwayGene[];
}

/** Options for KeggConnector. */
export interface KeggConnectorOptions {
	/** Optional cache store. */
	cache?: CacheStore;
	/** Optional cache policy. */
	cachePolicy?: CachePolicy;
}

/** Connector for KEGG REST API. */
export class KeggConnector extends BaseConnector {
	constructor(options: KeggConnectorOptions = {}) {
		const rateLimit: RateLimit = {
			requestsPerSecond: 3,
			maxRetries: 3,
		};
		super({
			name: "KEGG",
			baseUrl: "https://rest.kegg.jp",
			rateLimit,
			cache: options.cache,
			cachePolicy: options.cachePolicy,
		});
	}

	/**
	 * List all pathways for a given KEGG organism code.
	 *
	 * @param organism - KEGG organism code (e.g., "hsa" for human, "mmu" for mouse).
	 */
	async listPathways(organism: string): Promise<KeggPathwayEntry[]> {
		const text = await this.requestText(`/list/pathway/${organism}`);
		return this.parseTsv(text).map(([id, name]) => ({
			entryId: id,
			name: name ?? id,
		}));
	}

	/**
	 * Get a full pathway entry including its gene list.
	 *
	 * @param pathwayId - Full pathway identifier (e.g., "path:hsa00010").
	 */
	async getPathway(pathwayId: string): Promise<KeggPathway> {
		const text = await this.requestText(`/get/${pathwayId}`);
		return this.parsePathwayText(text, pathwayId);
	}

	/**
	 * Map gene IDs to the pathways they participate in.
	 *
	 * @param geneIds - List of KEGG gene IDs (e.g., ["hsa:7157", "hsa:3091"]).
	 * @returns A record mapping each gene ID to its pathway IDs.
	 */
	async linkGenesToPathways(geneIds: string[]): Promise<Record<string, string[]>> {
		if (geneIds.length === 0) return {};

		const ids = geneIds.join("+");
		const text = await this.requestText(`/link/pathway/${ids}`);

		const mapping: Record<string, string[]> = {};
		for (const [geneId, pathwayId] of this.parseTsv(text)) {
			if (!mapping[geneId]) mapping[geneId] = [];
			mapping[geneId].push(pathwayId);
		}
		return mapping;
	}

	/** Parse KEGG TSV format into [col1, col2][] tuples. */
	private parseTsv(text: string): Array<[string, string]> {
		return text
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
			.map((line) => {
				const tab = line.indexOf("\t");
				return [line.slice(0, tab), line.slice(tab + 1)] as [string, string];
			});
	}

	/** Parse KEGG pathway text format (NAME + GENE sections). */
	private parsePathwayText(text: string, pathwayId: string): KeggPathway {
		const lines = text.split("\n");

		let name = pathwayId;
		const genes: KeggPathwayGene[] = [];
		let inGeneSection = false;

		for (const line of lines) {
			const trimmed = line.trim();

			if (trimmed.startsWith("NAME")) {
				name = trimmed.replace(/^NAME\s+/, "").trim();
			}

			if (trimmed.startsWith("GENE")) {
				inGeneSection = true;
				// First GENE line may have gene entries after the field name
				const rest = trimmed.replace(/^GENE\s+/, "");
				if (rest) genes.push(...this.parseGeneEntries(rest));
				continue;
			}

			if (inGeneSection) {
				if (trimmed.startsWith("COMPOUND") || trimmed.startsWith("REFERENCE") || trimmed.startsWith("DBLINKS")) {
					inGeneSection = false;
					continue;
				}
				// Continuation lines in the GENE section — may be blank or contain more genes
				if (trimmed.length > 0) {
					genes.push(...this.parseGeneEntries(trimmed));
				}
			}
		}

		return { id: pathwayId, name, genes };
	}

	/** Parse gene entries from a single GENE section line. */
	private parseGeneEntries(line: string): KeggPathwayGene[] {
		const entries: KeggPathwayGene[] = [];
		// KEGG gene format: "3101; description" or "3101, 3098, 3099; description"
		// Multiple genes separated by spaces within a group
		const parts = line.split(/\s+/);
		for (const part of parts) {
			if (part.includes(";")) {
				const [id, ...desc] = part.split(";");
				entries.push({ geneId: id.trim(), name: desc.join(";").trim() || id.trim() });
			}
		}
		return entries;
	}
}
