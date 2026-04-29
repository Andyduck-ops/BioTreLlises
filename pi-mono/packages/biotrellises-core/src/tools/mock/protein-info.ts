/**
 * Mock protein information tool for parallel development.
 * Returns hardcoded but realistic protein data.
 */

import { Type } from "@mariozechner/pi-ai";
import type { BioAgentTool } from "../../registry.js";

const ProteinInfoParams = Type.Object({
	query: Type.String({ minLength: 1, description: "Protein name, gene symbol, or UniProt ID" }),
	include_domains: Type.Optional(
		Type.Boolean({ default: true, description: "Whether to include protein domain information" }),
	),
});

type ProteinInfoParamsType = typeof ProteinInfoParams;

interface DomainInfo {
	name: string;
	range: string;
	function: string;
}

interface ProteinResult {
	name: string;
	uniprotId: string;
	geneSymbol: string;
	molecularWeight: string;
	length: number;
	function: string;
	domains: DomainInfo[];
}

const P53_PROTEIN: ProteinResult = {
	name: "Cellular tumor antigen p53",
	uniprotId: "P04637",
	geneSymbol: "TP53",
	molecularWeight: "43.7 kDa",
	length: 393,
	function:
		"Acts as a tumor suppressor in many tumor types; induces growth arrest or apoptosis depending on the physiological circumstances and cell type. Involved in cell cycle regulation as a trans-activator that acts to negatively regulate cell division by controlling a set of genes required for this process.",
	domains: [
		{ name: "Transactivation domain (TAD1)", range: "1-40", function: "Recruits transcriptional coactivators" },
		{ name: "Transactivation domain (TAD2)", range: "41-61", function: "Binds MDM2 for ubiquitination regulation" },
		{ name: "Proline-rich domain", range: "62-92", function: "Mediates apoptotic activity" },
		{
			name: "DNA-binding domain (DBD)",
			range: "102-292",
			function: "Sequence-specific DNA binding; most mutation hotspot in cancer",
		},
		{
			name: "Tetramerization domain (TD)",
			range: "323-356",
			function: "Oligomerization required for transcriptional activity",
		},
		{ name: "Regulatory domain (CTD)", range: "357-393", function: "Regulates DNA binding and stability" },
	],
};

const EXAMPLE_PROTEIN: ProteinResult = {
	name: "Example protein (mock data)",
	uniprotId: "MOCK001",
	geneSymbol: "MOCK1",
	molecularWeight: "50 kDa",
	length: 450,
	function:
		"This is mock protein data returned when no specific match is found. Replace with real connector in production.",
	domains: [
		{ name: "Mock domain A", range: "1-100", function: "Example function A" },
		{ name: "Mock domain B", range: "101-200", function: "Example function B" },
	],
};

function formatProteinResult(protein: ProteinResult, includeDomains: boolean): string {
	let text =
		`Protein: ${protein.name}\n` +
		`UniProt ID: ${protein.uniprotId}\n` +
		`Gene Symbol: ${protein.geneSymbol}\n` +
		`Molecular Weight: ${protein.molecularWeight}\n` +
		`Length: ${protein.length} amino acids\n` +
		`\nFunction:\n${protein.function}`;

	if (includeDomains && protein.domains.length > 0) {
		text += "\n\nDomains:\n";
		for (const d of protein.domains) {
			text += `- ${d.name} (${d.range}): ${d.function}\n`;
		}
	}

	return text;
}

function findProtein(query: string): ProteinResult {
	const lower = query.toLowerCase();
	if (lower.includes("p53") || lower.includes("tp53")) return P53_PROTEIN;
	return EXAMPLE_PROTEIN;
}

export const mockProteinInfoTool: BioAgentTool<ProteinInfoParamsType, { query: string; uniprotId: string }> = {
	name: "protein_info",
	label: "Protein Information",
	category: "structure",
	description:
		"Retrieve protein information by name, gene symbol, or UniProt ID. Returns molecular weight, amino acid length, functional description, and optionally a list of structural domains with their ranges and functions. Useful for understanding protein architecture and functional regions.",
	parameters: ProteinInfoParams,
	execute: async (_toolCallId, params) => {
		const protein = findProtein(params.query);
		const includeDomains = params.include_domains ?? true;
		return {
			content: [{ type: "text", text: formatProteinResult(protein, includeDomains) }],
			details: { query: params.query, uniprotId: protein.uniprotId },
		};
	},
};
