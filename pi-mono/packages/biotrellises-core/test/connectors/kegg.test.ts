/**
 * Unit tests for KeggConnector.
 */

import nock from "nock";
import { beforeEach, describe, expect, it } from "vitest";
import { KeggConnector } from "../../src/connectors/kegg.js";

describe("KeggConnector", () => {
	let connector: KeggConnector;

	beforeEach(() => {
		connector = new KeggConnector();
		nock.cleanAll();
	});

	describe("listPathways", () => {
		it("parses pathway listing TSV", async () => {
			nock("https://rest.kegg.jp")
				.get("/list/pathway/hsa")
				.reply(
					200,
					"path:hsa00010\tGlycolysis / Gluconeogenesis - Homo sapiens (human)\npath:hsa00020\tCitrate cycle (TCA cycle) - Homo sapiens (human)\n",
				);

			const pathways = await connector.listPathways("hsa");
			expect(pathways).toHaveLength(2);
			expect(pathways[0].entryId).toBe("path:hsa00010");
			expect(pathways[0].name).toContain("Glycolysis");
		});

		it("handles empty response", async () => {
			nock("https://rest.kegg.jp").get("/list/pathway/zzz").reply(200, "");

			const pathways = await connector.listPathways("zzz");
			expect(pathways).toEqual([]);
		});
	});

	describe("linkGenesToPathways", () => {
		it("maps genes to pathways", async () => {
			nock("https://rest.kegg.jp")
				.get("/link/pathway/hsa:7157+hsa:3091")
				.reply(200, "hsa:7157\tpath:hsa04115\nhsa:7157\tpath:hsa04110\nhsa:3091\tpath:hsa00020\n");

			const mapping = await connector.linkGenesToPathways(["hsa:7157", "hsa:3091"]);
			expect(Object.keys(mapping)).toHaveLength(2);
			expect(mapping["hsa:7157"]).toEqual(["path:hsa04115", "path:hsa04110"]);
			expect(mapping["hsa:3091"]).toEqual(["path:hsa00020"]);
		});

		it("returns empty object for empty input", async () => {
			const mapping = await connector.linkGenesToPathways([]);
			expect(mapping).toEqual({});
		});
	});

	describe("error handling", () => {
		it("throws ConnectorError on HTTP error", async () => {
			nock("https://rest.kegg.jp").get("/list/pathway/hsa").reply(404, "Not Found");

			await expect(connector.listPathways("hsa")).rejects.toThrow("HTTP 404");
		});
	});
});
