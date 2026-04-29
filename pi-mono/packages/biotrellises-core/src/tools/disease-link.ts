/**
 * Disease-gene association tool using NCBI ClinVar.
 */

import { Type } from "@mariozechner/pi-ai";
import type { ClinvarConnector } from "../connectors/clinvar.js";
import type { BioAgentTool } from "../registry.js";

const DiseaseLinkParams = Type.Object({
	query: Type.String({ minLength: 1, description: "Gene symbol or disease name to search for" }),
	limit: Type.Optional(Type.Number({ default: 10, maximum: 50, description: "Maximum number of variants to return" })),
});

type DiseaseLinkParamsType = typeof DiseaseLinkParams;

const SIGNIFICANCE_ORDER: Record<string, number> = {
	Pathogenic: 0,
	"Likely pathogenic": 1,
	"Uncertain significance": 2,
	"Likely benign": 3,
	Benign: 4,
};

/**
 * Create a disease-variant association tool backed by ClinVar.
 *
 * @param clinvar - ClinVar connector instance.
 */
export function createDiseaseLinkTool(
	clinvar: ClinvarConnector,
): BioAgentTool<DiseaseLinkParamsType, { query: string; count: number }> {
	return {
		name: "disease_link",
		label: "Disease-Gene Association",
		category: "disease",
		description:
			"Search ClinVar database for disease-associated genetic variants by gene symbol or disease name. Returns variant details including clinical significance (Pathogenic, Likely pathogenic, etc.), associated conditions, and review status. Useful for linking genes to diseases and identifying clinically relevant mutations.",
		parameters: DiseaseLinkParams,
		execute: async (_toolCallId, params) => {
			const searchResult = await clinvar.search(params.query, params.limit ?? 10);

			if (searchResult.ids.length === 0) {
				return {
					content: [{ type: "text", text: `No ClinVar variants found for: "${params.query}"` }],
					details: { query: params.query, count: 0 },
				};
			}

			const variants = await clinvar.fetchDetails(searchResult.ids);

			// Sort by clinical significance (pathogenic first)
			variants.sort((a, b) => {
				const sa = SIGNIFICANCE_ORDER[a.clinicalSignificance ?? ""] ?? 9;
				const sb = SIGNIFICANCE_ORDER[b.clinicalSignificance ?? ""] ?? 9;
				return sa - sb;
			});

			const lines: string[] = [
				`Found ${searchResult.count} ClinVar variant(s) for "${params.query}" (showing ${variants.length}):`,
				"",
			];

			for (const v of variants) {
				lines.push(`• Variation ID: ${v.variationId}`);
				if (v.geneSymbol) lines.push(`  Gene: ${v.geneSymbol}`);
				if (v.clinicalSignificance) lines.push(`  Significance: ${v.clinicalSignificance}`);
				if (v.condition) lines.push(`  Condition: ${v.condition}`);
				if (v.reviewStatus) lines.push(`  Review: ${v.reviewStatus}`);
				lines.push("");
			}

			return {
				content: [{ type: "text", text: lines.join("\n") }],
				details: { query: params.query, count: searchResult.count },
			};
		},
	};
}
