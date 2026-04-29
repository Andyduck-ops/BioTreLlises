/**
 * Pathway enrichment tool using KEGG REST API.
 */

import { Type } from "@mariozechner/pi-ai";
import type { KeggConnector } from "../connectors/kegg.js";
import type { BioAgentTool } from "../registry.js";

const PathwayEnrichParams = Type.Object({
	genes: Type.Array(Type.String(), {
		minItems: 1,
		description: "Gene symbols or identifiers to perform enrichment on",
	}),
	organism: Type.Optional(
		Type.String({
			default: "hsa",
			description: "KEGG organism code (e.g., 'hsa' for human, 'mmu' for mouse)",
		}),
	),
	limit: Type.Optional(Type.Number({ default: 10, maximum: 50, description: "Maximum number of pathways to return" })),
});

type PathwayEnrichParamsType = typeof PathwayEnrichParams;

/**
 * Create a pathway enrichment tool backed by KEGG.
 *
 * @param kegg - KEGG connector instance.
 */
export function createPathwayEnrichTool(
	kegg: KeggConnector,
): BioAgentTool<PathwayEnrichParamsType, { geneCount: number; pathwayCount: number }> {
	return {
		name: "pathway_enrich",
		label: "Pathway Enrichment",
		category: "pathway",
		description:
			"Perform KEGG pathway enrichment analysis for a list of genes. Maps each gene to KEGG pathways, ranks pathways by the number of input genes they contain, and returns enriched pathways with gene lists. Useful for understanding which biological pathways are over-represented in a gene set.",
		parameters: PathwayEnrichParams,
		execute: async (_toolCallId, params) => {
			const organism = params.organism ?? "hsa";
			const inputGenes = params.genes;
			const limit = params.limit ?? 10;

			// Build KEGG gene IDs from input
			const keggGeneIds = inputGenes.map((g) => `${organism}:${g}`);

			// Get gene-to-pathway mappings
			const geneToPathways = await kegg.linkGenesToPathways(keggGeneIds);

			if (Object.keys(geneToPathways).length === 0) {
				return {
					content: [
						{
							type: "text",
							text: `No pathway associations found for ${inputGenes.length} gene(s) in organism "${organism}".`,
						},
					],
					details: { geneCount: inputGenes.length, pathwayCount: 0 },
				};
			}

			// Count genes per pathway
			const pathwayGeneCounts = new Map<string, { count: number; genes: string[] }>();
			for (const [geneId, pathwayIds] of Object.entries(geneToPathways)) {
				for (const pathwayId of pathwayIds) {
					const entry = pathwayGeneCounts.get(pathwayId) ?? { count: 0, genes: [] };
					entry.count++;
					entry.genes.push(geneId.replace(`${organism}:`, ""));
					pathwayGeneCounts.set(pathwayId, entry);
				}
			}

			// Sort pathways by gene count descending, take top N
			const ranked = [...pathwayGeneCounts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, limit);

			// Fetch pathway names
			const allPathways = await kegg.listPathways(organism);
			const pathwayNames = new Map(allPathways.map((p) => [p.entryId, p.name]));

			const mappedCount = Object.keys(geneToPathways).length;
			const lines: string[] = [
				`Pathway enrichment for ${inputGenes.length} gene(s) (${mappedCount} mapped to pathways):`,
				"",
			];

			for (const [pathwayId, info] of ranked) {
				const name = pathwayNames.get(pathwayId) ?? pathwayId;
				const geneList = info.genes.join(", ");
				lines.push(`• ${name}`);
				lines.push(`  Pathway ID: ${pathwayId}`);
				lines.push(`  Genes: ${info.count} — ${geneList}`);
				lines.push("");
			}

			return {
				content: [{ type: "text", text: lines.join("\n") }],
				details: { geneCount: inputGenes.length, pathwayCount: ranked.length },
			};
		},
	};
}
