/**
 * Protein information tool using UniProt REST API.
 */

import { Type } from "@mariozechner/pi-ai";
import type { UniprotConnector } from "../connectors/uniprot.js";
import type { BioAgentTool } from "../registry.js";

const ProteinInfoParams = Type.Object({
	query: Type.String({ minLength: 1, description: "Protein name, gene symbol, or UniProt accession ID" }),
	include_domains: Type.Optional(
		Type.Boolean({
			default: true,
			description: "Whether to include protein domain information from UniProt features",
		}),
	),
});

type ProteinInfoParamsType = typeof ProteinInfoParams;

/**
 * Create a protein info tool backed by UniProt.
 *
 * @param uniprot - UniProt connector instance.
 */
export function createProteinInfoTool(
	uniprot: UniprotConnector,
): BioAgentTool<ProteinInfoParamsType, { query: string; accession: string }> {
	return {
		name: "protein_info",
		label: "Protein Information",
		category: "structure",
		description:
			"Retrieve protein information by name, gene symbol, or UniProt accession using the UniProt database. Returns molecular weight, amino acid length, functional description, and optionally a list of structural domains with their ranges and functions. Useful for understanding protein architecture and functional regions.",
		parameters: ProteinInfoParams,
		execute: async (_toolCallId, params) => {
			// First search for the protein
			const searchResult = await uniprot.search(params.query, 1);

			if (searchResult.results.length === 0) {
				return {
					content: [{ type: "text", text: `No proteins found for query: "${params.query}"` }],
					details: { query: params.query, accession: "" },
				};
			}

			const entry = searchResult.results[0];
			const accession = entry.primaryAccession;

			// Fetch full details
			const fullEntry = await uniprot.getEntry(accession);

			const proteinName =
				fullEntry.proteinDescription?.recommendedName?.fullName?.value ??
				fullEntry.proteinDescription?.alternativeNames?.[0]?.fullName?.value ??
				"Unknown protein";

			const geneSymbol = fullEntry.genes?.[0]?.geneName?.value ?? "";
			const organism = fullEntry.organism?.scientificName ?? "";
			const length = fullEntry.sequence?.length ?? 0;
			const molWeight = fullEntry.sequence?.molWeight ?? 0;

			// Extract function from comments
			const functionComments = fullEntry.comments?.filter((c) => c.commentType === "FUNCTION") ?? [];
			const functionText =
				functionComments.flatMap((c) => c.texts?.map((t) => t.value) ?? []).join(" ") ||
				"No functional description available.";

			const lines: string[] = [`Protein: ${proteinName}`, `UniProt ID: ${accession}`];
			if (geneSymbol) lines.push(`Gene Symbol: ${geneSymbol}`);
			if (organism) lines.push(`Organism: ${organism}`);
			if (length) lines.push(`Length: ${length} amino acids`);
			if (molWeight) lines.push(`Molecular Weight: ${(molWeight / 1000).toFixed(1)} kDa`);
			lines.push("");
			lines.push(`Function:`);
			lines.push(functionText);

			// Extract domains from features if requested
			if (params.include_domains !== false && fullEntry.features) {
				const domains = fullEntry.features.filter(
					(f) => f.type === "DOMAIN" || f.type === "REGION" || f.type === "MOTIF",
				);
				if (domains.length > 0) {
					lines.push("");
					lines.push("Domains / Regions:");
					for (const d of domains.slice(0, 20)) {
						const start = d.location?.start?.position ?? "?";
						const end = d.location?.end?.position ?? "?";
						lines.push(`  • ${d.type}: ${d.description ?? "Unnamed"} (${start}-${end})`);
					}
					if (domains.length > 20) {
						lines.push(`  ... and ${domains.length - 20} more`);
					}
				}
			}

			return {
				content: [{ type: "text", text: lines.join("\n") }],
				details: { query: params.query, accession },
			};
		},
	};
}
