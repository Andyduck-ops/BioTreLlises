/**
 * End-to-end integration tests for BioTreLlises.
 *
 * Tests the full pipeline: connectors → registry → agent → reasoning.
 * Uses mock connectors to avoid external API calls.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { BioAgent } from "../../src/agent/bio-agent.js";
import type { NcbiConnector } from "../../src/connectors/ncbi.js";
import type { PubmedConnector } from "../../src/connectors/pubmed.js";
import type { UniprotConnector } from "../../src/connectors/uniprot.js";
import { DefaultAggregator } from "../../src/reasoning/aggregator.js";
import { DefaultExecutor } from "../../src/reasoning/executor.js";
import { DefaultPlanner } from "../../src/reasoning/planner.js";
import { DefaultBioToolRegistry } from "../../src/registry.js";
import { createGeneSearchTool } from "../../src/tools/gene-search.js";
import { createProteinInfoTool } from "../../src/tools/protein-info.js";
import { createPubMedSearchTool } from "../../src/tools/pubmed-search.js";

describe("E2E: BioTreLlises integration", () => {
	let mockNcbi: NcbiConnector;
	let mockPubmed: PubmedConnector;
	let mockUniprot: UniprotConnector;

	beforeEach(() => {
		mockNcbi = {
			search: vi.fn(),
			summary: vi.fn(),
			fetchRecords: vi.fn(),
		} as unknown as NcbiConnector;

		mockPubmed = {
			search: vi.fn(),
			fetchSummaries: vi.fn(),
		} as unknown as PubmedConnector;

		mockUniprot = {
			search: vi.fn(),
			getEntry: vi.fn(),
		} as unknown as UniprotConnector;
	});

	it("should assemble full tool registry", () => {
		const registry = new DefaultBioToolRegistry();
		registry.register(createGeneSearchTool(mockNcbi));
		registry.register(createProteinInfoTool(mockUniprot));
		registry.register(createPubMedSearchTool(mockPubmed));

		const tools = registry.getAll();
		expect(tools).toHaveLength(3);
		expect(tools.map((t) => t.name)).toContain("gene_search");
		expect(tools.map((t) => t.name)).toContain("protein_info");
		expect(tools.map((t) => t.name)).toContain("pubmed_search");
	});

	it("should create BioAgent with registry", () => {
		const registry = new DefaultBioToolRegistry();
		registry.register(createGeneSearchTool(mockNcbi));

		const agent = new BioAgent({
			registry,
		});

		expect(agent.registry).toBe(registry);
		expect(agent.state.tools).toHaveLength(1);
		expect(agent.state.systemPrompt).toContain("bioinformatics");
	});

	it("should plan a gene-related query", async () => {
		const registry = new DefaultBioToolRegistry();
		registry.register(createGeneSearchTool(mockNcbi));

		const planner = new DefaultPlanner();
		const plan = await planner.plan("Find information about TP53 gene", registry);

		expect(plan.subProblems.length).toBeGreaterThan(0);
		expect(plan.subProblems.some((sp) => sp.toolCategories.includes("sequence"))).toBe(true);
	});

	it("should execute a plan with mocked tools", async () => {
		mockNcbi.search = vi.fn().mockResolvedValue({
			db: "gene",
			ids: ["7157"],
			count: 1,
		});
		mockNcbi.summary = vi.fn().mockResolvedValue({
			uids: ["7157"],
			7157: {
				uid: "7157",
				name: "TP53",
				description: "tumor protein p53",
				organism: { scientificname: "Homo sapiens" },
			},
		});

		const registry = new DefaultBioToolRegistry();
		registry.register(createGeneSearchTool(mockNcbi));

		const agent = new BioAgent({
			registry,
		});

		const planner = new DefaultPlanner();
		const executor = new DefaultExecutor();
		const aggregator = new DefaultAggregator();

		const plan = await planner.plan("TP53 gene", registry);
		const results = await executor.execute(plan, agent);
		const report = await aggregator.aggregate(results, "TP53 gene");

		expect(results.length).toBeGreaterThan(0);
		expect(report.summary).toBeTruthy();
		expect(["high", "medium", "low"]).toContain(report.confidence);
	});

	it("should suggest tools by keywords", () => {
		const registry = new DefaultBioToolRegistry();
		registry.register(createGeneSearchTool(mockNcbi));
		registry.register(createProteinInfoTool(mockUniprot));
		registry.register(createPubMedSearchTool(mockPubmed));

		const proteinTools = registry.suggest("protein structure");
		expect(proteinTools.some((t) => t.name === "protein_info")).toBe(true);

		const litTools = registry.suggest("find papers");
		expect(litTools.some((t) => t.name === "pubmed_search")).toBe(true);
	});

	it("should handle multi-intent query planning", async () => {
		const registry = new DefaultBioToolRegistry();
		registry.register(createGeneSearchTool(mockNcbi));
		registry.register(createProteinInfoTool(mockUniprot));
		registry.register(createPubMedSearchTool(mockPubmed));

		const planner = new DefaultPlanner();
		const plan = await planner.plan("What is known about BRCA1 protein and recent literature?", registry);

		const categories = plan.subProblems.flatMap((sp) => sp.toolCategories);
		expect(categories).toContain("structure");
		expect(categories).toContain("literature");
	});
});
