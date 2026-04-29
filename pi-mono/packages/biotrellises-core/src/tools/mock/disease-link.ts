/**
 * Mock disease_link tool.
 * Returns hardcoded but realistic ClinVar variant data.
 */

import { Type } from "@mariozechner/pi-ai";
import type { BioAgentTool } from "../../registry.js";

const DiseaseLinkParams = Type.Object({
	query: Type.String({ minLength: 1, description: "Gene symbol or disease name to search for" }),
	limit: Type.Optional(Type.Number({ default: 10, maximum: 50, description: "Maximum number of variants to return" })),
});

type DiseaseLinkParamsType = typeof DiseaseLinkParams;

const MOCK_VARIANTS: Record<string, string[]> = {
	BRCA1: [
		"• Variation ID: 17661\n  Gene: BRCA1\n  Significance: Pathogenic\n  Condition: Hereditary breast and ovarian cancer syndrome\n  Review: criteria provided, multiple submitters, no conflicts\n",
		"• Variation ID: 54321\n  Gene: BRCA1\n  Significance: Likely pathogenic\n  Condition: Breast-ovarian cancer, familial 1\n  Review: criteria provided, single submitter\n",
	],
	TP53: [
		"• Variation ID: 12345\n  Gene: TP53\n  Significance: Pathogenic\n  Condition: Li-Fraumeni syndrome\n  Review: criteria provided, multiple submitters, no conflicts\n",
	],
	CFTR: [
		"• Variation ID: 38486\n  Gene: CFTR\n  Significance: Pathogenic\n  Condition: Cystic fibrosis\n  Review: criteria provided, multiple submitters, no conflicts\n",
	],
	default: [
		"• Variation ID: 99999\n  Gene: SAMPLE\n  Significance: Uncertain significance\n  Condition: Not specified\n  Review: criteria provided, single submitter\n",
	],
};

export const mockDiseaseLinkTool: BioAgentTool<DiseaseLinkParamsType, { query: string; count: number }> = {
	name: "disease_link",
	label: "Disease-Gene Association (mock)",
	category: "disease",
	description: "Mock ClinVar search returning sample variant data.",
	parameters: DiseaseLinkParams,
	execute: async (_toolCallId, params) => {
		const variants = MOCK_VARIANTS[params.query.toUpperCase()] ?? MOCK_VARIANTS.default;
		return {
			content: [
				{
					type: "text",
					text: `Found ${variants.length} ClinVar variant(s) for "${params.query}":\n\n${variants.join("\n")}`,
				},
			],
			details: { query: params.query, count: variants.length },
		};
	},
};
