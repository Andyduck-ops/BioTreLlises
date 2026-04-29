/**
 * Unit tests for pathway-enrich tool.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KeggConnector } from "../../src/connectors/kegg.js";
import { createPathwayEnrichTool } from "../../src/tools/pathway-enrich.js";

describe("createPathwayEnrichTool", () => {
	let mockKegg: KeggConnector;

	beforeEach(() => {
		mockKegg = {
			listPathways: vi.fn(),
			linkGenesToPathways: vi.fn(),
			getPathway: vi.fn(),
		} as unknown as KeggConnector;
	});

	it("returns ranked pathway enrichment results", async () => {
		mockKegg.linkGenesToPathways = vi.fn().mockResolvedValue({
			"hsa:7157": ["path:hsa04115", "path:hsa04110"],
			"hsa:3091": ["path:hsa00020"],
		});
		mockKegg.listPathways = vi.fn().mockResolvedValue([
			{ entryId: "path:hsa04115", name: "p53 signaling pathway" },
			{ entryId: "path:hsa04110", name: "Cell cycle" },
			{ entryId: "path:hsa00020", name: "Citrate cycle (TCA cycle)" },
		]);

		const tool = createPathwayEnrichTool(mockKegg);
		const result = await tool.execute("test-id", { genes: ["7157", "3091"] });

		expect(mockKegg.linkGenesToPathways).toHaveBeenCalledWith(["hsa:7157", "hsa:3091"]);
		const text = (result.content[0] as { type: "text"; text: string }).text;
		expect(text).toContain("p53 signaling pathway");
		expect(text).toContain("Citrate cycle");
		expect(result.details.pathwayCount).toBe(3);
	});

	it("handles no pathway associations", async () => {
		mockKegg.linkGenesToPathways = vi.fn().mockResolvedValue({});

		const tool = createPathwayEnrichTool(mockKegg);
		const result = await tool.execute("test-id", { genes: ["UNKNOWN"] });

		expect((result.content[0] as { type: "text"; text: string }).text).toContain("No pathway associations found");
		expect(result.details.pathwayCount).toBe(0);
	});

	it("respects organism parameter", async () => {
		mockKegg.linkGenesToPathways = vi.fn().mockResolvedValue({});

		const tool = createPathwayEnrichTool(mockKegg);
		await tool.execute("test-id", { genes: ["Trp53"], organism: "mmu" });

		expect(mockKegg.linkGenesToPathways).toHaveBeenCalledWith(["mmu:Trp53"]);
	});
});
