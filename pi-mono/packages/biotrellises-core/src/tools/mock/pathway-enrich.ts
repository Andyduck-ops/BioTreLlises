/**
 * Mock pathway_enrich tool.
 * Returns hardcoded but realistic pathway enrichment data.
 */

import { Type } from "@mariozechner/pi-ai";
import type { BioAgentTool } from "../../registry.js";

const PathwayEnrichParams = Type.Object({
	genes: Type.Array(Type.String(), { minItems: 1, description: "Gene identifiers" }),
	organism: Type.Optional(Type.String({ default: "hsa", description: "KEGG organism code" })),
	limit: Type.Optional(Type.Number({ default: 10, maximum: 50, description: "Max pathways" })),
});

type PathwayEnrichParamsType = typeof PathwayEnrichParams;

export const mockPathwayEnrichTool: BioAgentTool<PathwayEnrichParamsType, { geneCount: number; pathwayCount: number }> =
	{
		name: "pathway_enrich",
		label: "Pathway Enrichment (mock)",
		category: "pathway",
		description: "Mock KEGG pathway enrichment returning sample data.",
		parameters: PathwayEnrichParams,
		execute: async (_toolCallId, params) => {
			const genes = params.genes;
			return {
				content: [
					{
						type: "text",
						text: [
							`Pathway enrichment for ${genes.length} gene(s) (${genes.length} mapped to pathways):`,
							"",
							"• Glycolysis / Gluconeogenesis - Homo sapiens (human)",
							"  Pathway ID: path:hsa00010",
							`  Genes: ${Math.min(genes.length, 5)} — ${genes.slice(0, 5).join(", ")}`,
							"",
							"• p53 signaling pathway - Homo sapiens (human)",
							"  Pathway ID: path:hsa04115",
							`  Genes: ${Math.min(genes.length, 3)} — ${genes.slice(0, 3).join(", ")}`,
							"",
						].join("\n"),
					},
				],
				details: { geneCount: genes.length, pathwayCount: 2 },
			};
		},
	};
