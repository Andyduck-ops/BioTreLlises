#!/usr/bin/env node
/**
 * BioTreLlises API test script.
 *
 * Tests the LLM connection and bio reasoning pipeline with a custom OpenAI-compatible API.
 *
 * Usage:
 *   PI_API_KEY=sk-xxx PI_BASE_URL=https://xxx.com/v1 PI_MODEL=MiMo-V2.5-Pro node scripts/test-bioagent.mjs
 */

const API_KEY = process.env.PI_API_KEY;
const BASE_URL = (process.env.PI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const MODEL_ID = process.env.PI_MODEL || "gpt-4o";

async function testLLM() {
	console.log(`\n=== Testing LLM connection ===`);
	console.log(`URL:   ${BASE_URL}`);
	console.log(`Model: ${MODEL_ID}`);
	console.log(`Key:   ${API_KEY ? API_KEY.slice(0, 8) + "..." : "MISSING"}`);
	console.log();

	const response = await fetch(`${BASE_URL}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${API_KEY}`,
		},
		body: JSON.stringify({
			model: MODEL_ID,
			messages: [
				{ role: "system", content: "You are a helpful bioinformatics assistant." },
				{
					role: "user",
					content:
						"Answer briefly: what is the function of the TP53 gene? What databases would you use to find protein structure and disease associations?",
				},
			],
			max_tokens: 500,
		}),
	});

	if (!response.ok) {
		const err = await response.text().catch(() => "unknown");
		throw new Error(`HTTP ${response.status}: ${err}`);
	}

	const data = await response.json();
	const text = data.choices?.[0]?.message?.content || "No content returned";
	console.log("Response:");
	console.log(text);
	console.log(`\nTokens: ${data.usage?.total_tokens || "unknown"}`);
	console.log(`Model:  ${data.model || MODEL_ID}`);
	return data;
}

async function testToolCall() {
	console.log(`\n=== Testing tool calling ===`);
	console.log();

	const response = await fetch(`${BASE_URL}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${API_KEY}`,
		},
		body: JSON.stringify({
			model: MODEL_ID,
			messages: [
				{
					role: "system",
					content: "You have access to bioinformatics tools. Use them when appropriate.",
				},
				{
					role: "user",
					content: "Find information about the TP53 gene. What tools would you use?",
				},
			],
			max_tokens: 500,
			tools: [
				{
					type: "function",
					function: {
						name: "gene_search",
						description: "Search NCBI Gene database for gene information",
						parameters: {
							type: "object",
							properties: {
								query: { type: "string", description: "Gene symbol" },
								organism: { type: "string", description: "Organism" },
							},
							required: ["query"],
						},
					},
				},
				{
					type: "function",
					function: {
						name: "protein_info",
						description: "Look up UniProt protein information",
						parameters: {
							type: "object",
							properties: {
								query: { type: "string", description: "Protein name or ID" },
							},
							required: ["query"],
						},
					},
				},
				{
					type: "function",
					function: {
						name: "pubmed_search",
						description: "Search PubMed literature",
						parameters: {
							type: "object",
							properties: {
								query: { type: "string", description: "Search query" },
								max_results: { type: "number" },
							},
							required: ["query"],
						},
					},
				},
			],
		}),
	});

	if (!response.ok) {
		const err = await response.text().catch(() => "unknown");
		throw new Error(`HTTP ${response.status}: ${err}`);
	}

	const data = await response.json();
	const msg = data.choices?.[0]?.message;
	console.log("Content:", msg?.content?.slice(0, 500) || "(no text content)");

	if (msg?.tool_calls?.length > 0) {
		console.log(`\nTool calls made: ${msg.tool_calls.length}`);
		for (const tc of msg.tool_calls) {
			console.log(`  - ${tc.function.name}(${tc.function.arguments.slice(0, 200)})`);
		}
	} else {
		console.log("\nNo tool calls made");
	}

	return data;
}

async function main() {
	if (!API_KEY) {
		console.error("ERROR: PI_API_KEY environment variable is required");
		console.error("Usage: PI_API_KEY=sk-xxx PI_BASE_URL=https://xxx.com/v1 PI_MODEL=gpt-4o node scripts/test-bioagent.mjs");
		process.exit(1);
	}

	try {
		await testLLM();
		await testToolCall();
		console.log("\n=== All tests passed ===");
	} catch (err) {
		console.error("\n=== TEST FAILED ===");
		console.error(err);
		process.exit(1);
	}
}

main();
