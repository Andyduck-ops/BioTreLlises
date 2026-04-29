/**
 * Mock gene search tool for parallel development.
 * Returns hardcoded but realistic gene data.
 */

import { Type } from "@mariozechner/pi-ai";
import type { BioAgentTool } from "../../registry.js";

const GeneSearchParams = Type.Object({
	query: Type.String({ minLength: 1, description: "Gene symbol, name, or identifier to search for" }),
	organism: Type.Optional(Type.String({ description: "Species name or taxonomy ID (e.g., 'Homo sapiens', 9606)" })),
	limit: Type.Optional(Type.Number({ default: 10, maximum: 100, description: "Maximum number of results to return" })),
});

type GeneSearchParamsType = typeof GeneSearchParams;

interface GeneResult {
	symbol: string;
	name: string;
	organism: string;
	location: string;
	description: string;
}

const MOCK_GENES: Record<string, GeneResult[]> = {
	tp53: [
		{
			symbol: "TP53",
			name: "Tumor protein p53",
			organism: "Homo sapiens",
			location: "17p13.1",
			description:
				"Tumor suppressor gene encoding the p53 protein, a transcription factor that regulates cell cycle and apoptosis. Mutations in TP53 are found in over 50% of human cancers.",
		},
	],
	brca1: [
		{
			symbol: "BRCA1",
			name: "Breast cancer type 1 susceptibility protein",
			organism: "Homo sapiens",
			location: "17q21.31",
			description:
				"DNA repair protein involved in maintaining genomic stability. Germline mutations confer high risk of breast and ovarian cancer.",
		},
	],
	default: [
		{
			symbol: "ACTB",
			name: "Actin beta",
			organism: "Homo sapiens",
			location: "7p22.1",
			description:
				"Highly conserved cytoskeletal protein involved in cell motility, structure, and integrity. Commonly used as a reference gene.",
		},
		{
			symbol: "GAPDH",
			name: "Glyceraldehyde-3-phosphate dehydrogenase",
			organism: "Homo sapiens",
			location: "12p13.31",
			description: "Key enzyme in glycolysis. Frequently used as a housekeeping gene in expression studies.",
		},
		{
			symbol: "HSP90AA1",
			name: "Heat shock protein 90 alpha family class A member 1",
			organism: "Homo sapiens",
			location: "14q32.33",
			description:
				"Molecular chaperone essential for protein folding and stability. Target of several anticancer drugs.",
		},
	],
};

function formatGeneResults(results: GeneResult[], limit: number): string {
	const sliced = results.slice(0, limit);
	return sliced
		.map(
			(g, i) =>
				`${i + 1}. ${g.symbol} — ${g.name}\n` +
				`   Organism: ${g.organism}\n` +
				`   Location: ${g.location}\n` +
				`   Description: ${g.description}`,
		)
		.join("\n\n");
}

function findGenes(query: string): GeneResult[] {
	const lower = query.toLowerCase();
	if (lower.includes("tp53")) return MOCK_GENES.tp53;
	if (lower.includes("brca1")) return MOCK_GENES.brca1;
	return MOCK_GENES.default;
}

export const mockGeneSearchTool: BioAgentTool<GeneSearchParamsType, { query: string; count: number }> = {
	name: "gene_search",
	label: "Gene Search",
	category: "sequence",
	description:
		"Search for genes by symbol, name, or identifier across organisms. Returns gene metadata including symbol, full name, genomic location, and functional description. Useful for finding genes of interest before downstream analysis.",
	parameters: GeneSearchParams,
	execute: async (_toolCallId, params) => {
		const results = findGenes(params.query);
		const limit = params.limit ?? 10;
		return {
			content: [{ type: "text", text: formatGeneResults(results, limit) }],
			details: { query: params.query, count: results.length },
		};
	},
};
