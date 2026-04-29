/**
 * Unit tests for protein-info tool.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UniprotConnector } from "../../src/connectors/uniprot.js";
import { createProteinInfoTool } from "../../src/tools/protein-info.js";

describe("createProteinInfoTool", () => {
	let mockUniprot: UniprotConnector;

	beforeEach(() => {
		mockUniprot = {
			search: vi.fn(),
			getEntry: vi.fn(),
		} as unknown as UniprotConnector;
	});

	it("should return formatted protein info", async () => {
		mockUniprot.search = vi.fn().mockResolvedValue({
			results: [{ primaryAccession: "P04637" }],
		});
		mockUniprot.getEntry = vi.fn().mockResolvedValue({
			primaryAccession: "P04637",
			proteinDescription: {
				recommendedName: { fullName: { value: "Cellular tumor antigen p53" } },
			},
			genes: [{ geneName: { value: "TP53" } }],
			organism: { scientificName: "Homo sapiens" },
			sequence: { length: 393, molWeight: 43653 },
			comments: [
				{
					commentType: "FUNCTION",
					texts: [{ value: "Acts as a tumor suppressor." }],
				},
			],
			features: [
				{
					type: "DOMAIN",
					description: "DNA-binding",
					location: { start: { position: 102 }, end: { position: 292 } },
				},
			],
		});

		const tool = createProteinInfoTool(mockUniprot);
		const result = await tool.execute("test-id", { query: "TP53" });

		const text = (result.content[0] as { type: "text"; text: string }).text;
		expect(text).toContain("P04637");
		expect(text).toContain("Cellular tumor antigen p53");
		expect(text).toContain("Acts as a tumor suppressor");
		expect(text).toContain("DNA-binding");
		expect(result.details.accession).toBe("P04637");
	});

	it("should handle no results", async () => {
		mockUniprot.search = vi.fn().mockResolvedValue({ results: [] });

		const tool = createProteinInfoTool(mockUniprot);
		const result = await tool.execute("test-id", { query: "xyz" });

		expect((result.content[0] as { type: "text"; text: string }).text).toContain("No proteins found");
		expect(result.details.accession).toBe("");
	});
});
