#!/usr/bin/env node
/**
 * BioTreLlises Planner Benchmark.
 *
 * Evaluates query decomposition quality against 10 ground-truth queries.
 *
 * Usage:
 *   export BIO_API_KEY=sk-xxx
 *   export BIO_API_URL=https://api.deepseek.com/v1
 *   export BIO_MODEL=deepseek-chat
 *   node scripts/benchmark-planner.mjs
 */

const API_KEY = process.env.BIO_API_KEY || process.env.OPENAI_API_KEY;
const BASE_URL = (process.env.BIO_API_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const MODEL = process.env.BIO_MODEL || "gpt-4o";

if (!API_KEY) {
	console.error("ERROR: BIO_API_KEY or OPENAI_API_KEY is required");
	process.exit(1);
}

// =============================================================================
// Ground-truth test cases
// =============================================================================

const TEST_CASES = [
	{
		query: "Find the genomic location and function of the TP53 gene",
		expectedCategories: ["sequence"],
		minSubProblems: 1,
		maxSubProblems: 2,
	},
	{
		query: "What are the protein domains of BRCA1 and their molecular functions?",
		expectedCategories: ["structure"],
		minSubProblems: 1,
		maxSubProblems: 2,
	},
	{
		query: "Search for recent publications about CRISPR-Cas9 gene therapy applications",
		expectedCategories: ["literature"],
		minSubProblems: 1,
		maxSubProblems: 2,
	},
	{
		query: "What disease-associated variants are found in the CFTR gene?",
		expectedCategories: ["disease"],
		minSubProblems: 1,
		maxSubProblems: 2,
	},
	{
		query: "Analyze pathway enrichment for EGFR, KRAS, and BRAF in colorectal cancer",
		expectedCategories: ["pathway"],
		minSubProblems: 1,
		maxSubProblems: 2,
	},
	{
		query: "Analyze the role of EGFR mutations in lung cancer, including protein domains and drug associations",
		expectedCategories: ["sequence", "structure", "disease", "literature"],
		minSubProblems: 3,
		maxSubProblems: 5,
	},
	{
		query: "Investigate BRCA1: its gene location, protein structure, related diseases, and recent research publications",
		expectedCategories: ["sequence", "structure", "disease", "literature"],
		minSubProblems: 3,
		maxSubProblems: 5,
	},
	{
		query: "TP53基因的功能、相关疾病和最新研究进展",
		expectedCategories: ["sequence", "disease", "literature"],
		minSubProblems: 2,
		maxSubProblems: 4,
	},
	{
		query: "BRCA1和BRCA2基因的蛋白质结构、相关疾病通路以及临床变异",
		expectedCategories: ["structure", "pathway", "disease"],
		minSubProblems: 2,
		maxSubProblems: 4,
	},
	{
		query: "分析EGFR基因在肺癌中的作用，包括其蛋白结构域、相关信号通路和靶向药物研究文献",
		expectedCategories: ["sequence", "structure", "pathway", "literature"],
		minSubProblems: 3,
		maxSubProblems: 5,
	},
];

// =============================================================================
// LLM API helper
// =============================================================================

async function callLLM(messages, maxTokens = 2000) {
	const body = {
		model: MODEL,
		messages,
		max_tokens: maxTokens,
		temperature: 0.1,
	};

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
// Planner prompt
// =============================================================================

const CATEGORIES_DESC = [
	'  - **sequence**: gene_search — NCBI Gene database',
	'  - **structure**: protein_info — UniProt database',
	'  - **literature**: pubmed_search — PubMed database',
	'  - **disease**: disease_link — ClinVar database',
	'  - **pathway**: pathway_enrich — KEGG pathway analysis',
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
5. Use exact category names in toolCategories (sequence, structure, literature, disease, pathway) — NOT the tool function names

Respond with ONLY the JSON object, no other text.`;

// =============================================================================
// Evaluation
// =============================================================================

const VALID_CATEGORIES = ["sequence", "structure", "literature", "disease", "pathway"];

function evaluatePlan(plan, testCase) {
	const scores = {
		categoryAccuracy: 0,
		countMatch: 0,
		dependencyCorrectness: 0,
	};

	// Extract categories from plan
	const planCategories = [...new Set(plan.subProblems.flatMap((sp) => sp.toolCategories))];

	// Category accuracy: what fraction of expected categories are present?
	const expected = testCase.expectedCategories;
	const matched = expected.filter((c) => planCategories.includes(c));
	scores.categoryAccuracy = matched.length / expected.length;

	// Count match: is the number of sub-problems within expected range?
	const count = plan.subProblems.length;
	if (count >= testCase.minSubProblems && count <= testCase.maxSubProblems) {
		scores.countMatch = 1;
	} else if (count >= testCase.minSubProblems - 1 && count <= testCase.maxSubProblems + 1) {
		scores.countMatch = 0.5;
	} else {
		scores.countMatch = 0;
	}

	// Dependency correctness: all sub-problems should be parallel (no dependencies)
	// unless the query genuinely requires sequential steps
	const hasDeps = plan.subProblems.some((sp) => sp.dependsOn && sp.dependsOn.length > 0);
	// For most bio queries, parallel is correct. Only multi-step enrichment might need deps.
	scores.dependencyCorrectness = hasDeps ? 0.5 : 1;

	// Check for invalid categories
	const invalid = planCategories.filter((c) => !VALID_CATEGORIES.includes(c));
	if (invalid.length > 0) {
		scores.categoryAccuracy *= 0.5; // penalty
	}

	// Overall score (0-1)
	const overall = (scores.categoryAccuracy + scores.countMatch + scores.dependencyCorrectness) / 3;

	return { scores, overall, planCategories, invalid };
}

// =============================================================================
// Main benchmark loop
// =============================================================================

async function runBenchmark() {
	console.log("=".repeat(70));
	console.log("BioTreLlises Planner Benchmark");
	console.log("=".repeat(70));
	console.log(`URL:   ${BASE_URL}`);
	console.log(`Model: ${MODEL}`);
	console.log(`Cases: ${TEST_CASES.length}`);
	console.log();

	const results = [];
	let totalTokens = 0;

	for (let i = 0; i < TEST_CASES.length; i++) {
		const tc = TEST_CASES[i];
		console.log(`-`.repeat(70));
		console.log(`[${i + 1}/${TEST_CASES.length}] ${tc.query}`);
		console.log(`Expected: ${tc.expectedCategories.join(", ")}`);

		try {
			const result = await callLLM([{ role: "user", content: PLANNER_PROMPT(tc.query) }]);
			totalTokens += result.usage?.total_tokens || 0;

			let plan;
			try {
				const text = result.message.content;
				const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
				const json = codeBlockMatch ? codeBlockMatch[1] : text;
				plan = JSON.parse(json);
			} catch (e) {
				console.log(`  PARSE ERROR: ${e.message}`);
				results.push({ testCase: tc, error: e.message, overall: 0 });
				continue;
			}

			const { scores, overall, planCategories, invalid } = evaluatePlan(plan, tc);

			console.log(`  Plan: ${plan.subProblems.length} sub-problems`);
			console.log(`  Categories: ${planCategories.join(", ")}${invalid.length > 0 ? ` (invalid: ${invalid.join(", ")})` : ""}`);
			console.log(`  Score: category=${scores.categoryAccuracy.toFixed(2)} count=${scores.countMatch.toFixed(2)} deps=${scores.dependencyCorrectness.toFixed(2)} overall=${overall.toFixed(2)}`);

			results.push({ testCase: tc, scores, overall, plan });
		} catch (err) {
			console.log(`  API ERROR: ${err.message}`);
			results.push({ testCase: tc, error: err.message, overall: 0 });
		}

		// Small delay to avoid rate limits
		await new Promise((r) => setTimeout(r, 500));
	}

	// =============================================================================
	// Summary report
	// =============================================================================
	console.log();
	console.log("=".repeat(70));
	console.log("BENCHMARK SUMMARY");
	console.log("=".repeat(70));

	const validResults = results.filter((r) => !r.error);
	const errors = results.filter((r) => r.error);

	if (errors.length > 0) {
		console.log(`\nErrors (${errors.length}):`);
		for (const e of errors) {
			console.log(`  ✗ ${e.testCase.query.slice(0, 60)}... — ${e.error}`);
		}
	}

	console.log(`\nResults (${validResults.length}/${TEST_CASES.length} successful):`);
	for (let i = 0; i < results.length; i++) {
		const r = results[i];
		const status = r.error ? "✗ ERR" : r.overall >= 0.8 ? "✓ PASS" : r.overall >= 0.5 ? "~ WEAK" : "✗ FAIL";
		console.log(`  ${status} [${i + 1}] ${r.testCase.query.slice(0, 55)}... — ${r.error ? "ERROR" : r.overall.toFixed(2)}`);
	}

	if (validResults.length > 0) {
		const avgOverall = validResults.reduce((s, r) => s + r.overall, 0) / validResults.length;
		const avgCategory = validResults.reduce((s, r) => s + r.scores.categoryAccuracy, 0) / validResults.length;
		const avgCount = validResults.reduce((s, r) => s + r.scores.countMatch, 0) / validResults.length;
		const avgDeps = validResults.reduce((s, r) => s + r.scores.dependencyCorrectness, 0) / validResults.length;

		const passCount = validResults.filter((r) => r.overall >= 0.8).length;
		const weakCount = validResults.filter((r) => r.overall >= 0.5 && r.overall < 0.8).length;
		const failCount = validResults.filter((r) => r.overall < 0.5).length;

		console.log(`\nAverages:`);
		console.log(`  Category accuracy: ${avgCategory.toFixed(3)}`);
		console.log(`  Count match:       ${avgCount.toFixed(3)}`);
		console.log(`  Dependency correctness: ${avgDeps.toFixed(3)}`);
		console.log(`  Overall:           ${avgOverall.toFixed(3)}`);

		console.log(`\nDistribution:`);
		console.log(`  Pass  (≥0.8): ${passCount}`);
		console.log(`  Weak  (0.5-0.8): ${weakCount}`);
		console.log(`  Fail  (<0.5): ${failCount}`);
		console.log(`  Error: ${errors.length}`);

		console.log(`\nTotal tokens: ${totalTokens}`);
	}

	console.log();
	console.log("=".repeat(70));
}

runBenchmark().catch((err) => {
	console.error("\nFATAL:", err);
	process.exit(1);
});
