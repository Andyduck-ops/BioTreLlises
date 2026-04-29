/**
 * Unit tests for DefaultAggregator.
 */

import { describe, expect, it } from "vitest";
import { DefaultAggregator } from "../../src/reasoning/aggregator.js";
import type { SubProblemResult } from "../../src/reasoning/executor.js";

describe("DefaultAggregator", () => {
	const aggregator = new DefaultAggregator();

	it("should aggregate successful results with high confidence", async () => {
		const results: SubProblemResult[] = [
			{
				subProblemId: "sp-1",
				success: true,
				output: "Gene: TP53\nLocation: 17p13.1\nPMID: 12345678",
				durationMs: 100,
			},
			{
				subProblemId: "sp-2",
				success: true,
				output: "UniProt ID: P04637\nProtein: p53",
				durationMs: 150,
			},
		];

		const report = await aggregator.aggregate(results, "What is TP53?");

		expect(report.confidence).toBe("high");
		expect(report.summary).toContain("TP53");
		expect(report.summary).toContain("2 sub-problem(s) completed");
		expect(report.findings.length).toBeGreaterThan(0);
		expect(report.sources).toContain("PMID: 12345678");
		expect(report.sources).toContain("UniProt ID: P04637");
	});

	it("should lower confidence when some sub-problems fail", async () => {
		const results: SubProblemResult[] = [
			{ subProblemId: "sp-1", success: true, output: "Found gene data", durationMs: 100 },
			{ subProblemId: "sp-2", success: false, output: "", error: "Network timeout", durationMs: 5000 },
			{ subProblemId: "sp-3", success: true, output: "Found literature", durationMs: 200 },
		];

		const report = await aggregator.aggregate(results, "Research BRCA1");

		expect(report.confidence).toBe("medium");
		expect(report.findings.some((f) => f.includes("Error"))).toBe(true);
	});

	it("should return low confidence when most fail", async () => {
		const results: SubProblemResult[] = [
			{ subProblemId: "sp-1", success: false, output: "", error: "API error", durationMs: 100 },
			{ subProblemId: "sp-2", success: false, output: "", error: "Rate limited", durationMs: 100 },
		];

		const report = await aggregator.aggregate(results, "Query");

		expect(report.confidence).toBe("low");
	});

	it("should include consistency report in output", async () => {
		const results: SubProblemResult[] = [
			{
				subProblemId: "sp-1",
				success: true,
				output: "Gene: TP53\nThe data confirms p53 is a tumor suppressor.",
				durationMs: 100,
			},
			{
				subProblemId: "sp-2",
				success: true,
				output: "UniProt ID: P04637\nProtein function is consistent with tumor suppression.",
				durationMs: 150,
			},
		];

		const report = await aggregator.aggregate(results, "What is TP53?");

		expect(report.consistency).toBeDefined();
		expect(Array.isArray(report.consistency!.agreements)).toBe(true);
		expect(Array.isArray(report.consistency!.conflicts)).toBe(true);
	});
});
