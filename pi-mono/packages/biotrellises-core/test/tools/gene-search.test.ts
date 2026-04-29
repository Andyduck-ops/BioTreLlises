/**
 * Unit tests for gene-search tool.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NcbiConnector } from "../../src/connectors/ncbi.js";
import { createGeneSearchTool } from "../../src/tools/gene-search.js";

describe("createGeneSearchTool", () => {
	let mockNcbi: NcbiConnector;

	beforeEach(() => {
		mockNcbi = {
			search: vi.fn(),
			summary: vi.fn(),
		} as unknown as NcbiConnector;
	});

	it("should return formatted gene results", async () => {
		mockNcbi.search = vi.fn().mockResolvedValue({
			db: "gene",
			ids: ["7157"],
			count: 1,
		});
		mockNcbi.summary = vi.fn().mockResolvedValue([
			{
				uid: "7157",
				name: "TP53",
				description: "Tumor protein p53",
				organism: { scientificname: "Homo sapiens" },
				chromosomelocation: "17p13.1",
			},
		]);

		const tool = createGeneSearchTool(mockNcbi);
		const result = await tool.execute("test-id", { query: "TP53" });

		expect(mockNcbi.search).toHaveBeenCalledWith("gene", "TP53", 10);
		const text = (result.content[0] as { type: "text"; text: string }).text;
		expect(text).toContain("TP53");
		expect(text).toContain("Tumor protein p53");
		expect(result.details.count).toBe(1);
	});

	it("should append organism filter when provided", async () => {
		mockNcbi.search = vi.fn().mockResolvedValue({ db: "gene", ids: [], count: 0 });

		const tool = createGeneSearchTool(mockNcbi);
		await tool.execute("test-id", { query: "BRCA1", organism: "Homo sapiens" });

		expect(mockNcbi.search).toHaveBeenCalledWith("gene", "BRCA1 AND Homo sapiens[Organism]", 10);
	});

	it("should handle no results gracefully", async () => {
		mockNcbi.search = vi.fn().mockResolvedValue({ db: "gene", ids: [], count: 0 });

		const tool = createGeneSearchTool(mockNcbi);
		const result = await tool.execute("test-id", { query: "xyz" });

		expect((result.content[0] as { type: "text"; text: string }).text).toContain("No genes found");
		expect(result.details.count).toBe(0);
	});
});
