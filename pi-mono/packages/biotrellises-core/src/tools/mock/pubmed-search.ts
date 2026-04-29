/**
 * Mock PubMed literature search tool for parallel development.
 * Returns hardcoded but realistic publication data.
 */

import { Type } from "@mariozechner/pi-ai";
import type { BioAgentTool } from "../../registry.js";

const PubMedSearchParams = Type.Object({
	query: Type.String({ minLength: 1, description: "Search query for PubMed literature" }),
	max_results: Type.Optional(
		Type.Number({ default: 5, maximum: 50, description: "Maximum number of publications to return" }),
	),
	date_range: Type.Optional(Type.String({ description: "Optional date filter, e.g., '2020:2024' or 'last5years'" })),
});

type PubMedSearchParamsType = typeof PubMedSearchParams;

interface Publication {
	title: string;
	authors: string;
	journal: string;
	year: number;
	pmid: string;
	abstract: string;
}

const CRISPR_PAPERS: Publication[] = [
	{
		title: "CRISPR-Cas9 gene editing for treatment of sickle cell disease and beta-thalassemia",
		authors: "Frangoul H et al.",
		journal: "New England Journal of Medicine",
		year: 2021,
		pmid: "33283989",
		abstract:
			"This study reports the safety and efficacy of CTX001, an autologous CRISPR-Cas9-edited CD34+ hematopoietic stem and progenitor cell product, in patients with transfusion-dependent beta-thalassemia and sickle cell disease. All patients with transfusion-dependent beta-thalassemia were transfusion-independent at follow-up.",
	},
	{
		title: "Engineered CRISPR-Cas12a variants with increased activities and improved targeting ranges",
		authors: "Kleinstiver BP et al.",
		journal: "Nature Biotechnology",
		year: 2019,
		pmid: "30804536",
		abstract:
			"We describe engineered Acidaminococcus sp. Cas12a (AsCas12a) variants with expanded targeting ranges and improved editing efficiencies. These variants enable targeting of previously inaccessible protospacer adjacent motif (PAM) sequences.",
	},
	{
		title: "A CRISPR-Cas9 screen identifies essential genes in acute myeloid leukemia",
		authors: "Wang T et al.",
		journal: "Cell Reports",
		year: 2018,
		pmid: "2945612",
		abstract:
			"Using a genome-wide CRISPR-Cas9 screen, we identify genes essential for the proliferation and survival of acute myeloid leukemia (AML) cells. Our results reveal novel therapeutic targets and provide a comprehensive resource for AML biology.",
	},
];

const CANCER_PAPERS: Publication[] = [
	{
		title: "The hallmarks of cancer: new dimensions",
		authors: "Hanahan D et al.",
		journal: "Cancer Discovery",
		year: 2022,
		pmid: "35012351",
		abstract:
			"We revisit and expand the hallmarks of cancer framework, adding emerging capabilities such as epigenetic reprogramming, polymorphic microbiomes, and senescence. These new dimensions provide a more comprehensive understanding of tumor biology.",
	},
	{
		title: "Tumor mutational burden and response rate to PD-1 inhibition",
		authors: "Goodman AM et al.",
		journal: "New England Journal of Medicine",
		year: 2019,
		pmid: "30643254",
		abstract:
			"We investigate the relationship between tumor mutational burden (TMB) and response to anti-PD-1 therapy across multiple cancer types. Higher TMB is associated with improved objective response rates and progression-free survival.",
	},
];

const DEFAULT_PAPERS: Publication[] = [
	{
		title: "Molecular biology of the cell: a brief overview",
		authors: "Alberts B et al.",
		journal: "Nature Reviews Molecular Cell Biology",
		year: 2023,
		pmid: "MOCK001",
		abstract:
			"This is a mock publication for testing purposes. In production, this tool will query the real PubMed E-utilities API to retrieve actual biomedical literature.",
	},
];

function findPapers(query: string): Publication[] {
	const lower = query.toLowerCase();
	if (lower.includes("crispr")) return CRISPR_PAPERS;
	if (lower.includes("cancer")) return CANCER_PAPERS;
	return DEFAULT_PAPERS;
}

function formatPublications(papers: Publication[], maxResults: number): string {
	const sliced = papers.slice(0, maxResults);
	return sliced
		.map(
			(p, i) =>
				`${i + 1}. ${p.title}\n` +
				`   Authors: ${p.authors}\n` +
				`   Journal: ${p.journal} (${p.year})\n` +
				`   PMID: ${p.pmid}\n` +
				`   Abstract: ${p.abstract.slice(0, 200)}${p.abstract.length > 200 ? "..." : ""}`,
		)
		.join("\n\n");
}

export const mockPubMedSearchTool: BioAgentTool<PubMedSearchParamsType, { query: string; count: number }> = {
	name: "pubmed_search",
	label: "PubMed Literature Search",
	category: "literature",
	description:
		"Search biomedical literature on PubMed by keyword, topic, or research question. Returns publication titles, authors, journals, publication years, PMIDs, and abstracts. Useful for finding evidence supporting biological hypotheses, reviewing prior research, or identifying recent advances in a field.",
	parameters: PubMedSearchParams,
	execute: async (_toolCallId, params) => {
		const papers = findPapers(params.query);
		const maxResults = params.max_results ?? 5;
		return {
			content: [{ type: "text", text: formatPublications(papers, maxResults) }],
			details: { query: params.query, count: papers.length },
		};
	},
};
