/**
 * Unit tests for DefaultPlanner.
 */

import { describe, expect, it } from "vitest";
import { DefaultPlanner } from "../../src/reasoning/planner.js";
import { DefaultBioToolRegistry } from "../../src/registry.js";
import { mockGeneSearchTool, mockProteinInfoTool, mockPubMedSearchTool } from "../../src/tools/mock/index.js";

describe("DefaultPlanner", () => {
	const planner = new DefaultPlanner();

	it("should detect gene intent and create sequence sub-problem", async () => {
		const registry = new DefaultBioToolRegistry();
		const plan = await planner.plan("What is the function of TP53 gene?", registry);

		expect(plan.subProblems).toHaveLength(1);
		expect(plan.subProblems[0].toolCategories).toContain("sequence");
		expect(plan.subProblems[0].goal).toContain("TP53");
	});

	it("should detect multiple intents and create parallel sub-problems", async () => {
		const registry = new DefaultBioToolRegistry();
		const plan = await planner.plan("Find papers about TP53 protein structure and its role in cancer", registry);

		const categories = plan.subProblems.flatMap((sp) => sp.toolCategories);
		expect(categories).toContain("structure");
		expect(categories).toContain("literature");
		expect(categories).toContain("disease");
		// All should be parallel (no dependencies)
		expect(plan.subProblems.every((sp) => sp.dependsOn.length === 0)).toBe(true);
	});

	it("should use registry suggestion as fallback for unrecognized queries", async () => {
		const registry = new DefaultBioToolRegistry();
		registry.register(mockGeneSearchTool);
		registry.register(mockProteinInfoTool);
		registry.register(mockPubMedSearchTool);

		const plan = await planner.plan("blorfxyz123", registry);

		expect(plan.subProblems.length).toBeGreaterThan(0);
		expect(plan.reasoning).toContain("Decomposed");
	});
});
