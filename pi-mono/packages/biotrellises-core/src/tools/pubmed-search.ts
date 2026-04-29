/**
 * PubMed literature search tool using NCBI E-utilities.
 */

import { Type } from "@mariozechner/pi-ai";
import type { PubmedConnector } from "../connectors/pubmed.js";
import type { BioAgentTool } from "../registry.js";

const PubMedSearchParams = Type.Object({
	query: Type.String({ minLength: 1, description: "Search query for PubMed literature" }),
	max_results: Type.Optional(
		Type.Number({ default: 5, maximum: 50, description: "Maximum number of publications to return" }),
	),
	date_range: Type.Optional(Type.String({ description: "Optional date filter, e.g., '2020:2024' or 'last5years'" })),
});

type PubMedSearchParamsType = typeof PubMedSearchParams;

/**
 * Create a PubMed search tool backed by NCBI E-utilities.
 *
 * @param pubmed - PubMed connector instance.
 */
export function createPubMedSearchTool(
	pubmed: PubmedConnector,
): BioAgentTool<PubMedSearchParamsType, { query: string; count: number }> {
	return {
		name: "pubmed_search",
		label: "PubMed Literature Search",
		category: "literature",
		description:
			"Search biomedical literature on PubMed by keyword, topic, or research question. Returns publication titles, authors, journals, publication years, PMIDs, and abstracts. Useful for finding evidence supporting biological hypotheses, reviewing prior research, or identifying recent advances in a field.",
		parameters: PubMedSearchParams,
		execute: async (_toolCallId, params) => {
			const searchResult = await pubmed.search(params.query, params.max_results ?? 5, params.date_range);

			if (searchResult.ids.length === 0) {
				return {
					content: [{ type: "text", text: `No publications found for query: "${params.query}"` }],
					details: { query: params.query, count: 0 },
				};
			}

			const articles = await pubmed.fetchSummaries(searchResult.ids);

			const lines: string[] = [
				`Found ${searchResult.count} publication(s) for "${params.query}" (showing ${articles.length}):`,
				"",
			];

			for (let i = 0; i < articles.length; i++) {
				const a = articles[i];
				lines.push(`${i + 1}. ${a.title}`);
				if (a.authors) lines.push(`   Authors: ${a.authors}`);
				if (a.journal) lines.push(`   Journal: ${a.journal}${a.year ? ` (${a.year})` : ""}`);
				if (a.pmid) lines.push(`   PMID: ${a.pmid}`);
				if (a.abstract) {
					const truncated = a.abstract.length > 300 ? `${a.abstract.slice(0, 300)}...` : a.abstract;
					lines.push(`   Abstract: ${truncated}`);
				}
				lines.push("");
			}

			return {
				content: [{ type: "text", text: lines.join("\n") }],
				details: { query: params.query, count: searchResult.count },
			};
		},
	};
}
