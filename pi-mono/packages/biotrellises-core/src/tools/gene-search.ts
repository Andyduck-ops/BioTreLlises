/**
 * Gene search tool using NCBI E-utilities.
 */

import { Type } from "@mariozechner/pi-ai";
import type { NcbiConnector } from "../connectors/ncbi.js";
import type { BioAgentTool } from "../registry.js";

const GeneSearchParams = Type.Object({
	query: Type.String({ minLength: 1, description: "Gene symbol, name, or identifier to search for" }),
	organism: Type.Optional(Type.String({ description: "Species name or taxonomy ID (e.g., 'Homo sapiens', 9606)" })),
	limit: Type.Optional(Type.Number({ default: 10, maximum: 100, description: "Maximum number of results to return" })),
});

type GeneSearchParamsType = typeof GeneSearchParams;

/**
 * Create a gene search tool backed by NCBI.
 *
 * @param ncbi - NCBI connector instance.
 */
export function createGeneSearchTool(
	ncbi: NcbiConnector,
): BioAgentTool<GeneSearchParamsType, { query: string; count: number }> {
	return {
		name: "gene_search",
		label: "Gene Search",
		category: "sequence",
		description:
			"Search for genes by symbol, name, or identifier across organisms using NCBI Gene database. Returns gene metadata including symbol, full name, genomic location, and functional description. Useful for finding genes of interest before downstream analysis.",
		parameters: GeneSearchParams,
		execute: async (_toolCallId, params) => {
			let term = params.query;
			if (params.organism) {
				term += ` AND ${params.organism}[Organism]`;
			}

			const searchResult = await ncbi.search("gene", term, params.limit ?? 10);

			if (searchResult.ids.length === 0) {
				return {
					content: [{ type: "text", text: `No genes found for query: "${params.query}"` }],
					details: { query: params.query, count: 0 },
				};
			}

			const summaries = await ncbi.summary("gene", searchResult.ids);

			const lines: string[] = [
				`Found ${searchResult.count} gene(s) for "${params.query}" (showing ${summaries.length}):`,
				"",
			];

			for (const raw of summaries) {
				const doc = raw as Record<string, unknown>;
				const name = String(doc.name ?? doc.title ?? "Unknown");
				const description = String(doc.description ?? doc.summary ?? "No description available.");
				const org = doc.organism as Record<string, unknown> | undefined;
				const organism = String(org?.scientificname ?? org?.commonname ?? "");
				const location = String(doc.chromosomelocation ?? doc.maplocation ?? "");

				lines.push(`• ${name}`);
				if (organism) lines.push(`  Organism: ${organism}`);
				if (location) lines.push(`  Location: ${location}`);
				lines.push(`  ${description}`);
				lines.push("");
			}

			return {
				content: [{ type: "text", text: lines.join("\n") }],
				details: { query: params.query, count: searchResult.count },
			};
		},
	};
}
