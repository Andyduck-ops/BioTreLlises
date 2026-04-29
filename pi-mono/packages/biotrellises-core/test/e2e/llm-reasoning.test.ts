/**
 * End-to-end tests for LLM-driven reasoning pipeline.
 *
 * Tests the full LLM pipeline: LLMPlanner → Executor → LLMAggregator.
 * Uses mocked sub-agents to simulate LLM responses without real API calls.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BioAgent } from "../../src/agent/bio-agent.js";
import type { NcbiConnector } from "../../src/connectors/ncbi.js";
import type { PubmedConnector } from "../../src/connectors/pubmed.js";
import type { UniprotConnector } from "../../src/connectors/uniprot.js";
import type { AnalysisReport } from "../../src/reasoning/aggregator.js";
import { LLMAggregator } from "../../src/reasoning/aggregator.js";
import { DefaultExecutor } from "../../src/reasoning/executor.js";
import type { Plan } from "../../src/reasoning/planner.js";
import { LLMPlanner } from "../../src/reasoning/planner.js";
import { DefaultBioToolRegistry } from "../../src/registry.js";
import { createGeneSearchTool } from "../../src/tools/gene-search.js";
import { createProteinInfoTool } from "../../src/tools/protein-info.js";
import { createPubMedSearchTool } from "../../src/tools/pubmed-search.js";

/** Build a mock BioAgent whose `createSubAgent` returns an LLM-simulated sub-agent. */
function mockBioAgent(llmResponse: string): BioAgent {
	// The sub-agent simulates an LLM that emits the given text as an assistant message
	const mockSubAgent = {
		prompt: vi.fn().mockResolvedValue(undefined),
		waitForIdle: vi.fn().mockResolvedValue(undefined),
		subscribe: vi.fn().mockImplementation((listener: (event: unknown) => void) => {
			// Immediately fire a message_end event with the fake LLM response
			listener({
				type: "message_end",
				message: {
					role: "assistant",
					content: llmResponse,
				},
			});
			return () => {}; // unsubscribe no-op
		}),
	};

	return {
		createSubAgent: vi.fn().mockReturnValue(mockSubAgent),
		getToolsByCategory: vi.fn().mockReturnValue([{ name: "gene_search" }]),
		registry: {
			suggest: vi.fn().mockReturnValue([]),
		},
	} as unknown as BioAgent;
}

describe("E2E: LLM Reasoning Pipeline", () => {
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

	// ── LLMPlanner tests ───────────────────────────────────────────────

	describe("LLMPlanner", () => {
		it("should parse valid LLM JSON into a Plan", async () => {
			const registry = new DefaultBioToolRegistry();
			registry.register(createGeneSearchTool(mockNcbi));
			registry.register(createProteinInfoTool(mockUniprot));

			const llmJson = JSON.stringify({
				subProblems: [
					{
						id: "sp-1",
						goal: "Find sequence data for TP53",
						toolCategories: ["sequence"],
						dependsOn: [],
					},
					{
						id: "sp-2",
						goal: "Retrieve protein structure for TP53",
						toolCategories: ["structure"],
						dependsOn: [],
					},
				],
				reasoning: "Decomposed into gene search and protein structure tasks",
			});

			const agent = mockBioAgent(llmJson);
			const planner = new LLMPlanner(agent);

			const plan = await planner.plan("What is TP53?", registry);

			expect(plan.subProblems).toHaveLength(2);
			expect(plan.subProblems[0].toolCategories).toContain("sequence");
			expect(plan.subProblems[1].toolCategories).toContain("structure");
			expect(plan.reasoning).toContain("gene search");
		});

		it("should strip markdown code blocks from LLM response", async () => {
			const registry = new DefaultBioToolRegistry();
			registry.register(createGeneSearchTool(mockNcbi));

			const llmJson = '```json\n{\n  "subProblems": [],\n  "reasoning": "No decomposition needed"\n}\n```';

			const agent = mockBioAgent(llmJson);
			const planner = new LLMPlanner(agent);

			const plan = await planner.plan("test", registry);

			expect(plan.subProblems).toHaveLength(0);
			expect(plan.reasoning).toBe("No decomposition needed");
		});

		it("should fall back to KeywordPlanner when LLM returns invalid JSON", async () => {
			const registry = new DefaultBioToolRegistry();
			registry.register(createGeneSearchTool(mockNcbi));
			registry.register(createPubMedSearchTool(mockPubmed));

			const agent = mockBioAgent("not valid json at all {{{");
			const planner = new LLMPlanner(agent);

			// Should not throw — fallback kicks in
			const plan = await planner.plan("Find gene for TP53", registry);
			expect(plan.subProblems.length).toBeGreaterThan(0);
			expect(plan.reasoning).toBeTruthy();
		});

		it("should fall back to KeywordPlanner when LLM sub-agent prompt fails", async () => {
			const registry = new DefaultBioToolRegistry();
			registry.register(createGeneSearchTool(mockNcbi));

			const failingSubAgent = {
				prompt: vi.fn().mockRejectedValue(new Error("Model not available")),
				waitForIdle: vi.fn().mockResolvedValue(undefined),
				subscribe: vi.fn().mockReturnValue(() => {}),
			};

			const agent = {
				createSubAgent: vi.fn().mockReturnValue(failingSubAgent),
			} as unknown as BioAgent;

			const planner = new LLMPlanner(agent);
			const plan = await planner.plan("TP53", registry);

			// Fallback should produce a valid plan
			expect(plan.subProblems.length).toBeGreaterThan(0);
		});

		it("should use custom fallback when provided", async () => {
			const registry = new DefaultBioToolRegistry();
			registry.register(createGeneSearchTool(mockNcbi));

			const agent = mockBioAgent("bad json");

			const customFallback = {
				plan: vi.fn().mockResolvedValue({
					subProblems: [{ id: "sp-custom", goal: "Custom fallback", toolCategories: ["sequence"], dependsOn: [] }],
					reasoning: "Custom fallback",
				} as Plan),
			};

			const planner = new LLMPlanner(agent, customFallback);
			await planner.plan("test", registry);

			expect(customFallback.plan).toHaveBeenCalled();
		});
	});

	// ── LLMAggregator tests ────────────────────────────────────────────

	describe("LLMAggregator", () => {
		it("should parse valid LLM JSON into an AnalysisReport", async () => {
			const llmJson = JSON.stringify({
				summary: "TP53 is a tumor suppressor gene with key roles in cell cycle regulation.",
				findings: ["TP53 is located on chromosome 17p13.1", "Mutations in TP53 are common in cancers"],
				confidence: "high",
				sources: ["PMID: 12345678", "UniProt: P04637"],
			});

			const agent = mockBioAgent(llmJson);
			const aggregator = new LLMAggregator(agent);

			const report = await aggregator.aggregate(
				[{ subProblemId: "sp-1", success: true, output: "TP53 gene data", durationMs: 100 }],
				"What is TP53?",
			);

			expect(report.confidence).toBe("high");
			expect(report.summary).toContain("TP53");
			expect(report.findings).toHaveLength(2);
			expect(report.sources).toContain("PMID: 12345678");
		});

		it("should fall back to SimpleAggregator when LLM returns invalid JSON", async () => {
			const agent = mockBioAgent("not json");

			const aggregator = new LLMAggregator(agent);
			const report = await aggregator.aggregate(
				[
					{ subProblemId: "sp-1", success: true, output: "Gene: TP53\nPMID: 999", durationMs: 100 },
					{ subProblemId: "sp-2", success: true, output: "Protein: p53", durationMs: 150 },
				],
				"TP53 analysis",
			);

			// Fallback should still produce a valid report
			expect(report.summary).toBeTruthy();
			expect(["high", "medium", "low"]).toContain(report.confidence);
			expect(report.findings.length).toBeGreaterThan(0);
		});

		it("should fall back to SimpleAggregator when LLM sub-agent prompt fails", async () => {
			const failingSubAgent = {
				prompt: vi.fn().mockRejectedValue(new Error("API error")),
				waitForIdle: vi.fn().mockResolvedValue(undefined),
				subscribe: vi.fn().mockReturnValue(() => {}),
			};

			const agent = {
				createSubAgent: vi.fn().mockReturnValue(failingSubAgent),
			} as unknown as BioAgent;

			const aggregator = new LLMAggregator(agent);
			const report = await aggregator.aggregate(
				[{ subProblemId: "sp-1", success: true, output: "data", durationMs: 100 }],
				"query",
			);

			expect(report.summary).toBeTruthy();
		});

		it("should use custom fallback when provided", async () => {
			const agent = mockBioAgent("bad json");

			const customFallback = {
				aggregate: vi.fn().mockResolvedValue({
					summary: "Custom",
					findings: ["f1"],
					confidence: "low",
					sources: [],
				} as AnalysisReport),
			};

			const aggregator = new LLMAggregator(agent, customFallback);
			await aggregator.aggregate([], "query");

			expect(customFallback.aggregate).toHaveBeenCalled();
		});
	});

	// ── Full pipeline test ─────────────────────────────────────────────

	describe("Full LLM pipeline", () => {
		it("should run planner → executor → aggregator end-to-end with mocks", async () => {
			const registry = new DefaultBioToolRegistry();
			registry.register(createGeneSearchTool(mockNcbi));
			registry.register(createPubMedSearchTool(mockPubmed));

			function makeMockSubAgent(response: string) {
				return {
					prompt: vi.fn().mockResolvedValue(undefined),
					waitForIdle: vi.fn().mockResolvedValue(undefined),
					subscribe: vi.fn().mockImplementation((listener: (event: unknown) => void) => {
						listener({
							type: "message_end",
							message: { role: "assistant", content: response },
						});
						return () => {};
					}),
				};
			}

			const createSubAgent = vi.fn<(...args: unknown[]) => ReturnType<typeof makeMockSubAgent>>();

			const agent = {
				createSubAgent,
				getToolsByCategory: vi.fn().mockReturnValue([{ name: "gene_search" }]),
				registry: { suggest: vi.fn().mockReturnValue([]) },
			} as unknown as BioAgent;

			// Phase 1: Plan — sub-agent returns a decomposition
			createSubAgent.mockReturnValue(
				makeMockSubAgent(
					JSON.stringify({
						subProblems: [{ id: "sp-1", goal: "Search gene TP53", toolCategories: ["sequence"], dependsOn: [] }],
						reasoning: "Single gene search task",
					}),
				),
			);

			const planner = new LLMPlanner(agent);
			const plan = await planner.plan("What is TP53 gene?", registry);

			expect(plan.subProblems.length).toBeGreaterThan(0);
			expect(createSubAgent).toHaveBeenCalled();

			// Phase 2: Execute — switch mock to return executor-style sub-agents
			createSubAgent.mockReturnValue(makeMockSubAgent("TP53 data retrieved"));

			const executor = new DefaultExecutor();
			const results = await executor.execute(plan, agent);

			expect(results.length).toBe(plan.subProblems.length);

			// Phase 3: Aggregate — switch mock to return aggregator response
			createSubAgent.mockReturnValue(
				makeMockSubAgent(
					JSON.stringify({
						summary: "TP53 gene analysis completed successfully.",
						findings: ["TP53 is a tumor suppressor", "Located on chr17"],
						confidence: "high",
						sources: ["NCBI: TP53"],
					}),
				),
			);

			const aggregator = new LLMAggregator(agent);
			const report = await aggregator.aggregate(results, "What is TP53 gene?");

			expect(report.confidence).toBe("high");
			expect(report.summary).toContain("TP53");
			expect(report.findings.length).toBeGreaterThan(0);
		});
	});
});
