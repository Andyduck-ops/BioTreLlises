/**
 * Unit tests for pubmed-search tool.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PubmedConnector } from "../../src/connectors/pubmed.js";
import { createPubMedSearchTool } from "../../src/tools/pubmed-search.js";

describe("createPubMedSearchTool", () => {
	let mockPubmed: PubmedConnector;

	beforeEach(() => {
		mockPubmed = {
			search: vi.fn(),
			fetchSummaries: vi.fn(),
		} as unknown as PubmedConnector;
	});

	it("should return formatted article list", async () => {
		mockPubmed.search = vi.fn().mockResolvedValue({
			db: "pubmed",
			ids: ["33283989"],
			count: 1,
		});
		mockPubmed.fetchSummaries = vi.fn().mockResolvedValue([
			{
				pmid: "33283989",
				title: "CRISPR-Cas9 gene editing for treatment of sickle cell disease",
				authors: "Frangoul H",
				journal: "New England Journal of Medicine",
				year: "2021",
				abstract: "This study reports the safety and efficacy...",
			},
		]);

		const tool = createPubMedSearchTool(mockPubmed);
		const result = await tool.execute("test-id", { query: "CRISPR" });

		expect(mockPubmed.search).toHaveBeenCalledWith("CRISPR", 5, undefined);
		const text = (result.content[0] as { type: "text"; text: string }).text;
		expect(text).toContain("CRISPR-Cas9");
		expect(text).toContain("Frangoul H");
		expect(result.details.count).toBe(1);
	});

	it("should pass date_range to connector", async () => {
		mockPubmed.search = vi.fn().mockResolvedValue({ db: "pubmed", ids: [], count: 0 });

		const tool = createPubMedSearchTool(mockPubmed);
		await tool.execute("test-id", { query: "cancer", max_results: 10, date_range: "2020:2024" });

		expect(mockPubmed.search).toHaveBeenCalledWith("cancer", 10, "2020:2024");
	});

	it("should handle no results", async () => {
		mockPubmed.search = vi.fn().mockResolvedValue({ db: "pubmed", ids: [], count: 0 });

		const tool = createPubMedSearchTool(mockPubmed);
		const result = await tool.execute("test-id", { query: "xyz" });

		expect((result.content[0] as { type: "text"; text: string }).text).toContain("No publications found");
		expect(result.details.count).toBe(0);
	});
});
