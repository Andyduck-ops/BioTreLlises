/**
 * BioTreLlises CLI — terminal entry point for the bioinformatics AI agent.
 *
 * Usage:
 *   npx biotrellises
 *   npx biotrellises --model claude-sonnet-4-6
 *   npx biotrellises -m deepseek-chat -u https://api.deepseek.com/v1 -k sk-xxx
 */

import type { Model } from "@mariozechner/pi-ai";

import { BioAgent } from "./agent/bio-agent.js";
import { FileCacheStore } from "./cache/file-store.js";
import { MemoryCacheStore } from "./cache/memory-store.js";
import { ClinvarConnector } from "./connectors/clinvar.js";
import { KeggConnector } from "./connectors/kegg.js";
import { NcbiConnector } from "./connectors/ncbi.js";
import { PubmedConnector } from "./connectors/pubmed.js";
import { UniprotConnector } from "./connectors/uniprot.js";
import { LLMAggregator } from "./reasoning/aggregator.js";
import { DefaultExecutor } from "./reasoning/executor.js";
import { LLMPlanner } from "./reasoning/planner.js";
import { DefaultBioToolRegistry } from "./registry.js";
import { createDiseaseLinkTool } from "./tools/disease-link.js";
import { createGeneSearchTool } from "./tools/gene-search.js";
import { createPathwayEnrichTool } from "./tools/pathway-enrich.js";
import { createProteinInfoTool } from "./tools/protein-info.js";
import { createPubMedSearchTool } from "./tools/pubmed-search.js";
import { BioTuiApp } from "./tui/app.js";

const WELCOME = `
# Welcome to BioTreLlises

Your AI-powered bioinformatics research assistant.

## Available capabilities
- **Gene search** — query NCBI Gene database
- **Protein info** — look up UniProt entries
- **Literature search** — search PubMed for publications
- **Disease-gene links** — query ClinVar for variant-disease associations
- **Pathway enrichment** — KEGG pathway analysis for gene sets

Type a query below and press **Enter** to start.
`;

/** Parse simple CLI args. */
function parseArgs(argv: string[]): { model?: string; apiUrl?: string; apiKey?: string; modelId?: string; help: boolean } {
	const args = { help: false } as { model?: string; apiUrl?: string; apiKey?: string; modelId?: string; help: boolean };
	for (let i = 2; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--help" || arg === "-h") {
			args.help = true;
		} else if ((arg === "--model") && i + 1 < argv.length) {
			args.model = argv[++i];
		} else if ((arg === "--api-url" || arg === "-u") && i + 1 < argv.length) {
			args.apiUrl = argv[++i];
		} else if ((arg === "--api-key" || arg === "-k") && i + 1 < argv.length) {
			args.apiKey = argv[++i];
		} else if ((arg === "--model-id" || arg === "-m") && i + 1 < argv.length) {
			args.modelId = argv[++i];
		}
	}
	return args;
}

/** Build a custom Model for OpenAI-compatible APIs. */
function buildCustomModel(apiUrl: string, modelId: string): Model<"openai-completions"> {
	return {
		id: modelId,
		name: modelId,
		api: "openai-completions",
		provider: "openai",
		baseUrl: apiUrl.replace(/\/+$/, ""),
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128_000,
		maxTokens: 4096,
	};
}

function printHelp(): void {
	console.log(`
BioTreLlises — Bioinformatics AI Agent

Usage: biotrellises [options]

Options:
  -m, --model <model>    Set the AI model from built-in registry (default: claude-sonnet-4-6)
  -u, --api-url <url>    Custom OpenAI-compatible API base URL
  -k, --api-key <key>    API key for custom endpoint
  -i, --model-id <id>    Model ID for custom endpoint (e.g. deepseek-chat)
  -h, --help             Show this help message

Examples:
  biotrellises
  biotrellises --model claude-opus-4-7
  biotrellises -m deepseek-chat -u https://api.deepseek.com/v1 -k sk-xxx
`);
}

/** Main entry point. */
export async function main(argv: string[] = process.argv): Promise<void> {
	const args = parseArgs(argv);

	if (args.help) {
		printHelp();
		process.exit(0);
	}

	// Shared cache for all connectors — use file cache if env var is set
	const useFileCache = process.env.BIOTRELLISES_FILE_CACHE === "1";
	const cache = useFileCache ? new FileCacheStore() : new MemoryCacheStore();

	// Initialize connectors (name/baseUrl are set internally)
	const ncbi = new NcbiConnector({
		apiKey: process.env.NCBI_API_KEY,
		cache,
	});
	const pubmed = new PubmedConnector({
		apiKey: process.env.NCBI_API_KEY,
		cache,
	});
	const uniprot = new UniprotConnector({ cache });
	const clinvar = new ClinvarConnector({
		apiKey: process.env.NCBI_API_KEY,
		cache,
	});
	const kegg = new KeggConnector({ cache });

	// Build tool registry
	const registry = new DefaultBioToolRegistry();
	registry.register(createGeneSearchTool(ncbi));
	registry.register(createProteinInfoTool(uniprot));
	registry.register(createPubMedSearchTool(pubmed));
	registry.register(createDiseaseLinkTool(clinvar));
	registry.register(createPathwayEnrichTool(kegg));

	// Custom OpenAI-compatible API configuration
	let customModel: Model<"openai-completions"> | undefined;
	if (args.apiUrl && args.modelId) {
		if (args.apiKey) {
			process.env.OPENAI_API_KEY = args.apiKey;
		}
		customModel = buildCustomModel(args.apiUrl, args.modelId);
	}

	// Create BioAgent (model selection uses DefaultModelStrategy at runtime)
	const agent = new BioAgent({
		registry,
		initialState: {
			thinkingLevel: "medium",
			model: customModel,
		},
	});

	// Wire up LLM-driven reasoning pipeline.
	// LLMPlanner and LLMAggregator use the BioAgent to create sub-agents
	// for intelligent query decomposition and result synthesis.
	const pipeline = {
		planner: new LLMPlanner(agent),
		executor: new DefaultExecutor(),
		aggregator: new LLMAggregator(agent),
		registry,
	};

	// Start TUI
	const app = new BioTuiApp({ agent, welcomeMessage: WELCOME, pipeline });

	// Graceful shutdown
	process.on("SIGINT", () => {
		app.stop();
		process.exit(0);
	});

	app.start();
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	void main();
}
