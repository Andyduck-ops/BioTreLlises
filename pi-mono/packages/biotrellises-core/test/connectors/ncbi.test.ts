/**
 * Unit tests for NcbiConnector.
 */

import nock from "nock";
import { beforeEach, describe, expect, it } from "vitest";
import { NcbiConnector } from "../../src/connectors/ncbi.js";

describe("NcbiConnector", () => {
	let connector: NcbiConnector;

	beforeEach(() => {
		connector = new NcbiConnector();
		nock.cleanAll();
	});

	describe("search", () => {
		it("should return IDs for a gene search", async () => {
			nock("https://eutils.ncbi.nlm.nih.gov")
				.get("/entrez/eutils/esearch.fcgi")
				.query({ db: "gene", term: "TP53", retmax: 20, retmode: "json" })
				.reply(200, {
					esearchresult: {
						idlist: ["7157"],
						count: "1",
					},
				});

			const result = await connector.search("gene", "TP53");
			expect(result.db).toBe("gene");
			expect(result.ids).toEqual(["7157"]);
			expect(result.count).toBe(1);
		});

		it("should handle empty results", async () => {
			nock("https://eutils.ncbi.nlm.nih.gov")
				.get("/entrez/eutils/esearch.fcgi")
				.query({ db: "gene", term: "xyznonexistent", retmax: 20, retmode: "json" })
				.reply(200, {
					esearchresult: {
						idlist: [],
						count: "0",
					},
				});

			const result = await connector.search("gene", "xyznonexistent");
			expect(result.ids).toEqual([]);
			expect(result.count).toBe(0);
		});

		it("should include api_key when provided", async () => {
			const keyConnector = new NcbiConnector({ apiKey: "test-key" });
			nock("https://eutils.ncbi.nlm.nih.gov")
				.get("/entrez/eutils/esearch.fcgi")
				.query({ db: "gene", term: "BRCA1", retmax: 10, retmode: "json", api_key: "test-key" })
				.reply(200, {
					esearchresult: { idlist: ["672"], count: "1" },
				});

			const result = await keyConnector.search("gene", "BRCA1", 10);
			expect(result.ids).toEqual(["672"]);
		});
	});

	describe("summary", () => {
		it("should return document summaries", async () => {
			nock("https://eutils.ncbi.nlm.nih.gov")
				.get("/entrez/eutils/esummary.fcgi")
				.query({ db: "gene", id: "7157", retmode: "json" })
				.reply(200, {
					result: {
						uids: ["7157"],
						7157: {
							uid: "7157",
							title: "TP53",
							summary: "Tumor protein p53",
						},
					},
				});

			const docs = await connector.summary("gene", ["7157"]);
			expect(docs).toHaveLength(1);
			expect(docs[0].uid).toBe("7157");
			expect(docs[0].title).toBe("TP53");
		});

		it("should return empty array for empty IDs", async () => {
			const docs = await connector.summary("gene", []);
			expect(docs).toEqual([]);
		});
	});

	describe("fetchRecords", () => {
		it("should return raw XML text", async () => {
			nock("https://eutils.ncbi.nlm.nih.gov")
				.get("/entrez/eutils/efetch.fcgi")
				.query({ db: "gene", id: "7157", retmode: "xml" })
				.reply(200, "<?xml version='1.0'?><Gene></Gene>", { "Content-Type": "text/xml" });

			const text = await connector.fetchRecords("gene", ["7157"]);
			expect(text).toContain("<Gene>");
		});
	});

	describe("error handling", () => {
		it("should throw ConnectorError on HTTP error", async () => {
			nock("https://eutils.ncbi.nlm.nih.gov")
				.get("/entrez/eutils/esearch.fcgi")
				.query(true)
				.reply(503, "Service Unavailable");

			await expect(connector.search("gene", "TP53")).rejects.toThrow("HTTP 503");
		});
	});
});
