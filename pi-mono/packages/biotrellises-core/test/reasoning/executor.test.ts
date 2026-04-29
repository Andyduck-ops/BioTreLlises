/**
 * Unit tests for DefaultExecutor.
 */

import { describe, expect, it, vi } from "vitest";
import type { BioAgent } from "../../src/agent/bio-agent.js";
import { DefaultExecutor } from "../../src/reasoning/executor.js";
import type { Plan } from "../../src/reasoning/planner.js";

describe("DefaultExecutor", () => {
	const executor = new DefaultExecutor();

	it("should execute parallel sub-problems", async () => {
		const mockAgent = {
			getToolsByCategory: vi.fn().mockReturnValue([{ name: "gene_search" }]),
			createSubAgent: vi.fn().mockReturnValue({
				prompt: vi.fn().mockResolvedValue(undefined),
				waitForIdle: vi.fn().mockResolvedValue(undefined),
				subscribe: vi.fn().mockReturnValue(() => {}),
			}),
		} as unknown as BioAgent;

		const plan: Plan = {
			subProblems: [
				{ id: "sp-1", goal: "Find gene", toolCategories: ["sequence"], dependsOn: [] },
				{ id: "sp-2", goal: "Find protein", toolCategories: ["structure"], dependsOn: [] },
			],
			reasoning: "Test",
		};

		const results = await executor.execute(plan, mockAgent);

		expect(results).toHaveLength(2);
		expect(results[0].subProblemId).toBe("sp-1");
		expect(results[1].subProblemId).toBe("sp-2");
		expect(mockAgent.createSubAgent).toHaveBeenCalledTimes(2);
	});

	it("should handle execution errors gracefully", async () => {
		const mockAgent = {
			getToolsByCategory: vi.fn().mockReturnValue([{ name: "gene_search" }]),
			createSubAgent: vi.fn().mockReturnValue({
				prompt: vi.fn().mockRejectedValue(new Error("LLM failure")),
				waitForIdle: vi.fn().mockResolvedValue(undefined),
				subscribe: vi.fn().mockReturnValue(() => {}),
			}),
		} as unknown as BioAgent;

		const plan: Plan = {
			subProblems: [{ id: "sp-1", goal: "Fail", toolCategories: ["sequence"], dependsOn: [] }],
			reasoning: "Test",
		};

		const results = await executor.execute(plan, mockAgent);

		expect(results[0].success).toBe(false);
		expect(results[0].error).toContain("LLM failure");
	});
});
