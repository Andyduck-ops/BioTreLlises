#!/usr/bin/env node
/**
 * BioTreLlises Demo — run a full query through Planner → Executor → Aggregator.
 *
 * Usage:
 *   BIO_API_KEY=sk-xxx npx tsx scripts/demo.mjs "Analyze EGFR mutations in lung cancer"
 */

import {
	BioAgent,
	DefaultBioToolRegistry,
	NcbiConnector,
	UniprotConnector,
	PubmedConnector,
	ClinvarConnector,
	KeggConnector,
	MemoryCacheStore,
	createGeneSearchTool,
	createProteinInfoTool,
	createPubMedSearchTool,
	createDiseaseLinkTool,
	createPathwayEnrichTool,
	LLMPlanner,
	DefaultExecutor,
	LLMAggregator,
} from "../packages/biotrellises-core/dist/index.js";

const API_KEY = process.env.BIO_API_KEY || process.env.OPENAI_API_KEY;
const BASE_URL = (process.env.BIO_API_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const MODEL_ID = process.env.BIO_MODEL || "deepseek-chat";
const QUERY = process.argv[2] || "Analyze the role of EGFR mutations in lung cancer, including protein domains and drug associations";

if (!API_KEY) {
	console.error("ERROR: BIO_API_KEY or OPENAI_API_KEY is required");
	process.exit(1);
}

const cache = new MemoryCacheStore();

const ncbi    = new NcbiConnector({ cache });
const uniprot = new UniprotConnector({ cache });
const pubmed  = new PubmedConnector({ cache });
const clinvar = new ClinvarConnector({ cache });
const kegg    = new KeggConnector({ cache });

const registry = new DefaultBioToolRegistry();
registry.register(createGeneSearchTool(ncbi));
registry.register(createProteinInfoTool(uniprot));
registry.register(createPubMedSearchTool(pubmed));
registry.register(createDiseaseLinkTool(clinvar));
registry.register(createPathwayEnrichTool(kegg));

let customModel = undefined;
if (BASE_URL !== "https://api.openai.com/v1" || MODEL_ID !== "gpt-4o") {
	process.env.OPENAI_API_KEY = API_KEY;
	customModel = {
		id: MODEL_ID,
		name: MODEL_ID,
		api: "openai-completions",
		provider: "openai",
		baseUrl: BASE_URL,
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128_000,
		maxTokens: 4096,
	};
}

const agent = new BioAgent({
	registry,
	initialState: {
		thinkingLevel: "medium",
		model: customModel,
	},
});

const pipeline = {
	planner:    new LLMPlanner(agent),
	executor:   new DefaultExecutor(),
	aggregator: new LLMAggregator(agent),
	registry,
};

async function runDemo() {
	console.log("========================================");
	console.log("BioTreLlises — Full Reasoning Pipeline");
	console.log("========================================");
	console.log("");
	console.log("Query: \"" + QUERY + "\"");
	console.log("Model: " + MODEL_ID);
	console.log("");

	// Step 1: Plan
	console.log("----------------------------------------");
	console.log("STEP 1: PLANNER — Query Decomposition");
	console.log("----------------------------------------");
	const startPlan = Date.now();
	const plan = await pipeline.planner.plan(QUERY, registry);
	console.log("Time:  " + (Date.now() - startPlan) + "ms");
	console.log("");
	console.log("Reasoning: " + plan.reasoning);
	console.log("");
	console.log("Sub-problems (" + plan.subProblems.length + "):");
	for (const sp of plan.subProblems) {
		const deps = sp.dependsOn.length > 0 ? sp.dependsOn.join(", ") : "none";
		console.log("  [" + sp.id + "] " + sp.goal);
		console.log("       categories: " + sp.toolCategories.join(", "));
		console.log("       depends on: " + deps);
	}
	console.log("");

	// Step 2: Execute (mock results for demo)
	console.log("----------------------------------------");
	console.log("STEP 2: EXECUTOR — Parallel Tool Calls");
	console.log("----------------------------------------");

	const MOCK_RESULTS = [
		{
			subProblemId: plan.subProblems[0]?.id || "sp-1",
			success: true,
			output: "Gene: EGFR\nFull name: Epidermal growth factor receptor\nOrganism: Homo sapiens\nLocation: 7p11.2\nNCBI Gene ID: 1956\nSummary: Receptor tyrosine kinase involved in cell proliferation. Frequently mutated in NSCLC.",
			durationMs: 120,
		},
		{
			subProblemId: plan.subProblems[1]?.id || "sp-2",
			success: true,
			output: "Protein: Epidermal growth factor receptor\nUniProt ID: P00533\nLength: 1210 aa\nWeight: 134.3 kDa\nDomains: Extracellular (25-638), Transmembrane (669-689), Kinase (712-968), C-tail (969-1210)",
			durationMs: 150,
		},
		{
			subProblemId: plan.subProblems[2]?.id || "sp-3",
			success: true,
			output: "PubMed search for EGFR lung cancer drug associations:\nPMID: 12345678 — Gefitinib targeting EGFR exon 19 deletions\nPMID: 23456789 — Osimertinib for T790M resistance mutations\nPMID: 34567890 — Afatinib for exon 21 L858R mutations",
			durationMs: 200,
		},
		{
			subProblemId: plan.subProblems[3]?.id || "sp-4",
			success: true,
			output: "ClinVar variants for EGFR:\n  L858R (rs121434568): Pathogenic — NSCLC, sensitivity to TKIs\n  Exon 19 deletion: Pathogenic — NSCLC, gefitinib response\n  T790M (rs121434569): Pathogenic — acquired resistance to first-gen TKIs",
			durationMs: 180,
		},
		{
			subProblemId: plan.subProblems[4]?.id || "sp-5",
			success: true,
			output: "KEGG pathways enriched for EGFR:\n  hsa05223 — Non-small cell lung cancer (p=1.2e-8)\n  hsa04010 — MAPK signaling pathway\n  hsa04151 — PI3K-Akt signaling pathway",
			durationMs: 250,
		},
	];

	const results = MOCK_RESULTS.slice(0, plan.subProblems.length);
	for (const r of results) {
		console.log("  [" + r.subProblemId + "] " + (r.success ? "SUCCESS" : "FAILED") + " (" + r.durationMs + "ms)");
		const lines = r.output.split("\n").slice(0, 4);
		for (const line of lines) {
			console.log("       " + line.slice(0, 80));
		}
		if (r.output.split("\n").length > 4) {
			console.log("       ...");
		}
	}
	console.log("");

	// Step 3: Aggregate
	console.log("----------------------------------------");
	console.log("STEP 3: AGGREGATOR — Report Synthesis");
	console.log("----------------------------------------");
	const startAgg = Date.now();
	const report = await pipeline.aggregator.aggregate(results, QUERY);
	console.log("Time:  " + (Date.now() - startAgg) + "ms");
	console.log("");
	console.log("Summary: " + report.summary);
	console.log("");
	console.log("Findings (" + report.findings.length + "):");
	for (const f of report.findings) {
		console.log("  • " + f.slice(0, 100));
	}
	console.log("");
	console.log("Confidence: " + report.confidence);
	console.log("Sources:    " + report.sources.length + " identifiers");
	if (report.consistency) {
		console.log("");
		console.log("Cross-Source Consistency Check:");
		if (report.consistency.agreements.length > 0) {
			console.log("  Agreements:");
			for (const a of report.consistency.agreements) {
				console.log("    + " + a.slice(0, 100));
			}
		}
		if (report.consistency.conflicts.length > 0) {
			console.log("  Conflicts:");
			for (const c of report.consistency.conflicts) {
				console.log("    ! " + c.slice(0, 100));
			}
		}
		if (report.consistency.conflicts.length === 0) {
			console.log("  Conflicts: none");
		}
	}

	console.log("");
	console.log("========================================");
	console.log("Done");
	console.log("========================================");
}

runDemo().catch((err) => {
	console.error("\nFATAL:", err);
	process.exit(1);
});
