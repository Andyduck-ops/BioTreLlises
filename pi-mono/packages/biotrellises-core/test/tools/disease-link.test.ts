/**
 * Unit tests for disease-link tool.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClinvarConnector } from "../../src/connectors/clinvar.js";
import { createDiseaseLinkTool } from "../../src/tools/disease-link.js";

describe("createDiseaseLinkTool", () => {
	let mockClinvar: ClinvarConnector;

	beforeEach(() => {
		mockClinvar = {
			search: vi.fn(),
			fetchDetails: vi.fn(),
		} as unknown as ClinvarConnector;
	});

	it("returns formatted variant results", async () => {
		mockClinvar.search = vi.fn().mockResolvedValue({
			db: "clinvar",
			ids: ["17661"],
			count: 1,
		});
		mockClinvar.fetchDetails = vi.fn().mockResolvedValue([
			{
				variationId: "17661",
				geneSymbol: "BRCA1",
				clinicalSignificance: "Pathogenic",
				condition: "Hereditary breast and ovarian cancer syndrome",
				reviewStatus: "criteria provided, multiple submitters, no conflicts",
			},
		]);

		const tool = createDiseaseLinkTool(mockClinvar);
		const result = await tool.execute("test-id", { query: "BRCA1" });

		expect(mockClinvar.search).toHaveBeenCalledWith("BRCA1", 10);
		const text = (result.content[0] as { type: "text"; text: string }).text;
		expect(text).toContain("BRCA1");
		expect(text).toContain("Pathogenic");
		expect(result.details.count).toBe(1);
	});

	it("handles no results gracefully", async () => {
		mockClinvar.search = vi.fn().mockResolvedValue({ db: "clinvar", ids: [], count: 0 });

		const tool = createDiseaseLinkTool(mockClinvar);
		const result = await tool.execute("test-id", { query: "XYZ" });

		expect((result.content[0] as { type: "text"; text: string }).text).toContain("No ClinVar variants found");
		expect(result.details.count).toBe(0);
	});

	it("respects limit parameter", async () => {
		mockClinvar.search = vi.fn().mockResolvedValue({ db: "clinvar", ids: [], count: 0 });

		const tool = createDiseaseLinkTool(mockClinvar);
		await tool.execute("test-id", { query: "TP53", limit: 20 });

		expect(mockClinvar.search).toHaveBeenCalledWith("TP53", 20);
	});
});
