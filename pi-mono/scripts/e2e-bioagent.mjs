#!/usr/bin/env node
/**
 * BioTreLlises E2E Integration Test.
 *
 * Tests the full reasoning pipeline: Planner → Executor → Aggregator
 * using a user-provided OpenAI-compatible API.
 *
 * Usage:
 *   export BIO_API_KEY=tp-cm164pxrs9j0wh0ao4ythoa5icwu9sb5kr1ldxi4tfkerwmg
 *   export BIO_API_URL=https://token-plan-cn.xiaomimimo.com/v1
 *   export BIO_MODEL=mimo-v2.5-pro
 *   node scripts/e2e-bioagent.mjs
 */

const API_KEY = process.env.BIO_API_KEY || process.env.OPENAI_API_KEY;
const BASE_URL = (process.env.BIO_API_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const MODEL = process.env.BIO_MODEL || "gpt-4o";

if (!API_KEY) {
	console.error("ERROR: BIO_API_KEY is required");
	process.exit(1);
}

// =============================================================================
// Tool definitions (matching the actual BioTreLlises tools)
// =============================================================================

const TOOLS = [
	{
		type: "function",
		function: {
			name: "gene_search",
			description: "Search for genes by symbol, name, or identifier across organisms using NCBI Gene database. Returns gene metadata including symbol, full name, genomic location, and functional description.",
			parameters: {
				type: "object",
				properties: {
					query: { type: "string", description: "Gene symbol, name, or identifier to search for" },
					organism: { type: "string", description: "Species name or taxonomy ID (e.g., 'Homo sapiens', 9606)" },
					limit: { type: "number", default: 10, maximum: 100 },
				},
				required: ["query"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "protein_info",
			description: "Retrieve protein information by name, gene symbol, or UniProt accession using the UniProt database. Returns molecular weight, amino acid length, functional description, and optionally a list of structural domains with their ranges and functions.",
			parameters: {
				type: "object",
				properties: {
					query: { type: "string", description: "Protein name, gene symbol, or UniProt accession ID" },
				},
				required: ["query"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "pubmed_search",
			description: "Search biomedical literature on PubMed by keyword, topic, or research question. Returns publication titles, authors, journals, publication years, PMIDs, and abstracts.",
			parameters: {
				type: "object",
				properties: {
					query: { type: "string", description: "Search query for PubMed" },
					max_results: { type: "number", default: 5, maximum: 50 },
				},
				required: ["query"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "disease_link",
			description: "Search ClinVar database for disease-associated genetic variants by gene symbol or disease name. Returns variant details including clinical significance (Pathogenic, Likely pathogenic, etc.), associated conditions, and review status.",
			parameters: {
				type: "object",
				properties: {
					query: { type: "string", description: "Gene symbol or disease name" },
					limit: { type: "number", default: 10, maximum: 50 },
				},
				required: ["query"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "pathway_enrich",
			description: "Perform KEGG pathway enrichment analysis for a list of genes. Maps each gene to KEGG pathways, ranks pathways by the number of input genes they contain, and returns enriched pathways with gene lists.",
			parameters: {
				type: "object",
				properties: {
					genes: { type: "array", items: { type: "string" }, description: "Gene symbols" },
					organism: { type: "string", default: "hsa", description: "KEGG organism code" },
				},
				required: ["genes"],
			},
		},
	},
];

// =============================================================================
// Mock tool executor (simulates what the actual connector + tool stack does)
// =============================================================================

const TOOL_HANDLERS = {
	gene_search: async (args) => {
		const query = args.query || "unknown";
		if (query.toUpperCase() === "TP53") {
			return JSON.stringify({
				content: `Gene: TP53
Full name: Tumor protein p53
Organism: Homo sapiens
Location: 17p13.1
Summary: The TP53 gene encodes the p53 tumor suppressor protein, which regulates cell cycle, DNA repair, and apoptosis. It is the most frequently mutated gene in human cancers.
NCBI Gene ID: 7157
Also known as: p53, BCC7, LFS1, cellular tumor antigen p53`,
				details: { query, count: 1 },
			});
		}
		return JSON.stringify({
			content: `Found genes for "${query}": see NCBI Gene database for details.`,
			details: { query, count: 1 },
		});
	},
	protein_info: async (args) => {
		const query = (args.query || "").toUpperCase();
		if (query === "TP53" || query === "P53") {
			return JSON.stringify({
				content: `Protein: Tumor protein p53
UniProt ID: P04637
Gene Symbol: TP53
Organism: Homo sapiens
Length: 393 amino acids
Molecular Weight: 43.7 kDa
Function: Acts as a tumor suppressor. Induces growth arrest or apoptosis depending on cellular context.

Domains:
  • DOMAIN: Transactivation domain (1-61)
  • DOMAIN: Proline-rich region (64-92)
  • DOMAIN: DNA-binding domain (102-292)
  • DOMAIN: Tetramerization domain (323-356)
  • DOMAIN: C-terminal regulatory domain (363-393)`,
				details: { query, accession: "P04637" },
			});
		}
		return JSON.stringify({
			content: `Protein details not available for "${query}".`,
			details: { query, accession: "" },
		});
	},
	pubmed_search: async (args) => {
		return JSON.stringify({
			content: `Found publications for "${args.query}": see PubMed for full results.`,
			details: { query: args.query, count: 5 },
		});
	},
	disease_link: async (args) => {
		return JSON.stringify({
			content: `ClinVar findings for "${args.query}": see ClinVar database for full variant details.`,
			details: { query: args.query, count: 3 },
		});
	},
	pathway_enrich: async (args) => {
		return JSON.stringify({
			content: `Pathway enrichment for ${args.genes?.length || 0} gene(s).`,
			details: { geneCount: args.genes?.length || 0, pathwayCount: 2 },
		});
	},
};

// =============================================================================
// LLM API helper
// =============================================================================

async function callLLM(messages, tools = null, maxTokens = 2000) {
	const body = {
		model: MODEL,
		messages,
		max_tokens: maxTokens,
	};
	if (tools) body.tools = tools;
	if (!tools) body.temperature = 0.1;

	const response = await fetch(`${BASE_URL}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${API_KEY}`,
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const err = await response.text().catch(() => "unknown");
		throw new Error(`HTTP ${response.status}: ${err}`);
	}

	const data = await response.json();
	return {
		message: data.choices[0].message,
		usage: data.usage,
		model: data.model,
	};
}

// =============================================================================
// Test 1: Planner — Query Decomposition
// =============================================================================

const CATEGORIES_DESC = [
	'  - **sequence**:\n    - gene_search: Search for genes by symbol, name, or identifier across organisms using NCBI Gene database.',
	'  - **structure**:\n    - protein_info: Retrieve protein information by name, gene symbol, or UniProt accession using the UniProt database.',
	'  - **literature**:\n    - pubmed_search: Search biomedical literature on PubMed by keyword, topic, or research question.',
	'  - **disease**:\n    - disease_link: Search ClinVar database for disease-associated genetic variants by gene symbol or disease name.',
	'  - **pathway**:\n    - pathway_enrich: Perform KEGG pathway enrichment analysis for a list of genes.',
].join("\n");

const PLANNER_PROMPT = (query) => `You are a bioinformatics query planner. Decompose the user's query into independent sub-problems that can be solved in parallel.

Available tool categories:
${CATEGORIES_DESC}

User query: ${query}

Output a JSON object with this exact structure:
{
  "subProblems": [
    {
      "id": "sp-1",
      "goal": "description of what to find",
      "toolCategories": ["category_name"],
      "dependsOn": []
    }
  ],
  "reasoning": "explanation of the decomposition strategy"
}

Rules:
1. Each sub-problem should target exactly one tool category
2. Keep sub-problems independent (parallel) unless they truly depend on each other
3. Only use categories that are relevant to the query
4. Create at least 1 sub-problem, at most 5
5. Use exact category names from the available categories list

Respond with ONLY the JSON object, no other text.`;

async function testPlanner(query) {
	console.log(`\n${"=".repeat(60)}`);
	console.log(`TEST 1: Planner — Query Decomposition`);
	console.log(`${"=".repeat(60)}`);
	console.log(`Query: "${query}"`);
	console.log();

	const result = await callLLM([
		{ role: "user", content: PLANNER_PROMPT(query) },
	], null, 2000);

	let plan;
	try {
		const text = result.message.content;
		// Strip markdown code blocks
		const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
		const json = codeBlockMatch ? codeBlockMatch[1] : text;
		plan = JSON.parse(json);
	} catch (e) {
		console.error("FAILED to parse plan:", e.message);
		console.log("Raw output:", result.message.content);
		return null;
	}

	console.log("Reasoning:", plan.reasoning);
	console.log(`\nSub-problems (${plan.subProblems.length}):`);
	for (const sp of plan.subProblems) {
		console.log(`  [${sp.id}] goal: ${sp.goal}`);
		console.log(`         tools: ${sp.toolCategories.join(", ")}`);
		console.log(`         depends on: ${sp.dependsOn.length > 0 ? sp.dependsOn.join(", ") : "none"}`);
	}

	// Validate categories
	const validCategories = ["sequence", "structure", "literature", "disease", "pathway"];
	const invalid = plan.subProblems
		.flatMap(sp => sp.toolCategories)
		.filter(c => !validCategories.includes(c));
	if (invalid.length > 0) {
		console.log(`\n⚠ WARNING: Invalid categories used: ${[...new Set(invalid)].join(", ")}`);
	} else {
		console.log(`\n✓ All tool categories are valid`);
	}

	console.log(`\nModel: ${result.model} | Tokens: ${result.usage?.total_tokens || "?"}`);
	return plan;
}

// =============================================================================
// Test 2: Tool-using Agent — Single Query Execution
// =============================================================================

async function testToolExecution() {
	console.log(`\n${"=".repeat(60)}`);
	console.log(`TEST 2: Tool-Using Agent — Query Execution`);
	console.log(`${"=".repeat(60)}`);
	console.log();

	const messages = [
		{
			role: "system",
			content: `You are a bioinformatics agent with access to specialized tools.
For each query, use the most appropriate tool(s). If a tool returns results, present them clearly.
If you need multiple pieces of information, use multiple tools.`,
		},
		{ role: "user", content: "Find information about the TP53 gene and its associated protein. Check its disease associations too." },
	];

	const result = await callLLM(messages, TOOLS, 3000);
	const msg = result.message;

	console.log("Initial response:");

	if (msg.content) {
		console.log(msg.content.slice(0, 300) + "...");
	}

	if (msg.tool_calls && msg.tool_calls.length > 0) {
		console.log(`\nTool calls made: ${msg.tool_calls.length}`);
		for (const tc of msg.tool_calls) {
			console.log(`  ${tc.function.name}(${tc.function.arguments.slice(0, 200)})`);
		}

		// Push assistant message and execute each tool call
		messages.push(msg);
		for (const tc of msg.tool_calls) {
			const handler = TOOL_HANDLERS[tc.function.name];
			if (handler) {
				const args = JSON.parse(tc.function.arguments);
				const result = await handler(args);
				messages.push({
					role: "tool",
					tool_call_id: tc.id,
					content: result,
				});
			}
		}

		// Get final synthesis
		const finalResult = await callLLM(messages, null, 2000);
		console.log(`\nFinal synthesis (${finalResult.usage?.total_tokens || "?"} tokens):`);
		console.log(finalResult.message.content.slice(0, 500));
	}

	console.log(`\nModel: ${result.model} | Tokens: ${result.usage?.total_tokens || "?"}`);
}

// =============================================================================
// Test 3: Aggregator — Result Synthesis
// =============================================================================

async function testAggregator() {
	console.log(`\n${"=".repeat(60)}`);
	console.log(`TEST 3: Aggregator — Result Synthesis`);
	console.log(`${"=".repeat(60)}`);
	console.log();

	const mockResults = [
		{ subProblemId: "sp-1", success: true, output: "Gene TP53 found. Tumor suppressor p53. Located at 17p13.1. Regulates cell cycle and apoptosis." },
		{ subProblemId: "sp-2", success: true, output: "Protein P04637 (p53) has 393 aa, 43.7 kDa. Contains DNA-binding domain (102-292), tetramerization domain (323-356)." },
		{ subProblemId: "sp-3", success: true, output: "PubMed has 180,000+ publications on TP53. Key areas: cancer biology, apoptosis, DNA repair." },
	];

	const result = await callLLM([
		{
			role: "system",
			content: `You are a bioinformatics analysis aggregator. Synthesize sub-problem results into a coherent analysis report.

Output a JSON object with this exact structure:
{
  "summary": "concise 2-3 sentence synthesis of all findings",
  "findings": ["finding 1", "finding 2", "..."],
  "confidence": "high",
  "sources": ["source1", "source2", "..."]
}

Rules:
1. summary should synthesize across all results, not just list them
2. findings should be 3-8 concise bullet-point observations
3. confidence must be "high", "medium", or "low"
4. Do not fabricate data — only report what is present in the results

Respond with ONLY the JSON object, no other text.`,
		},
		{
			role: "user",
			content: `Original query: Analyze the TP53 gene, its protein structure, and associated literature.

Sub-problem results:
  - sp-1 [success]: ${mockResults[0].output}
  - sp-2 [success]: ${mockResults[1].output}
  - sp-3 [success]: ${mockResults[2].output}`,
		},
	], null, 2000);

	try {
		const text = result.message.content;
		const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
		const json = codeBlockMatch ? codeBlockMatch[1] : text;
		const report = JSON.parse(json);
		console.log("Summary:", report.summary);
		console.log(`\nFindings (${report.findings.length}):`);
		for (const f of report.findings) {
			console.log(`  • ${f}`);
		}
		console.log(`\nConfidence: ${report.confidence}`);
		console.log(`Sources: ${report.sources?.join(", ") || "none"}`);
	} catch (e) {
		console.log("Raw output:", result.message.content);
	}

	console.log(`\nModel: ${result.model} | Tokens: ${result.usage?.total_tokens || "?"}`);
}

// =============================================================================
// Main
// =============================================================================

async function main() {
	console.log(`BioTreLlises E2E Integration Test`);
	console.log(`URL:   ${BASE_URL}`);
	console.log(`Model: ${MODEL}`);
	console.log();

	const queries = [
		"Find information about the TP53 gene, its protein structure, and associated diseases",
		"What pathways is BRCA1 involved in? Find related literature.",
		"Analyze the role of EGFR mutations in lung cancer, including protein domains and drug associations",
	];

	for (const query of queries) {
		const plan = await testPlanner(query);
		if (!plan) continue;

		// Evaluate the plan quality
		const score = evaluatePlan(plan, query);
		console.log(`\nPlan quality: ${score}/5`);
		console.log(`-`.repeat(40));
	}

	await testToolExecution();
	await testAggregator();

	console.log(`\n${"=".repeat(60)}`);
	console.log("All E2E tests completed.");
}

function evaluatePlan(plan, query) {
	let score = 3; // baseline

	// Has reasoning
	if (plan.reasoning && plan.reasoning.length > 20) score++;
	// Has at least 2 sub-problems
	if (plan.subProblems.length >= 2) score++;
	// Sub-problems have valid categories
	const valid = ["sequence", "structure", "literature", "disease", "pathway"];
	const allValid = plan.subProblems.every(sp => sp.toolCategories.every(c => valid.includes(c)));
	if (allValid) score++;
	// Parallel structure (at least one sub-problem with no dependencies)
	const hasParallel = plan.subProblems.some(sp => sp.dependsOn.length === 0);
	if (hasParallel) score++;

	return Math.min(score, 5);
}

main().catch(err => {
	console.error("\nFATAL:", err);
	process.exit(1);
});
