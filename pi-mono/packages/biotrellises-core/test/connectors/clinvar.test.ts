/**
 * Unit tests for ClinvarConnector.
 */

import nock from "nock";
import { beforeEach, describe, expect, it } from "vitest";
import { ClinvarConnector } from "../../src/connectors/clinvar.js";

describe("ClinvarConnector", () => {
	let connector: ClinvarConnector;

	beforeEach(() => {
		connector = new ClinvarConnector();
		nock.cleanAll();
	});

	describe("search", () => {
		it("searches clinvar by gene name", async () => {
			nock("https://eutils.ncbi.nlm.nih.gov")
				.get("/entrez/eutils/esearch.fcgi")
				.query({
					db: "clinvar",
					term: "BRCA1[Gene Name] OR BRCA1[Title]",
					retmax: 10,
					retmode: "json",
				})
				.reply(200, { esearchresult: { idlist: ["17661", "54321"], count: "2" } });

			const result = await connector.search("BRCA1");
			expect(result.ids).toEqual(["17661", "54321"]);
			expect(result.count).toBe(2);
		});

		it("returns empty for no results", async () => {
			nock("https://eutils.ncbi.nlm.nih.gov")
				.get("/entrez/eutils/esearch.fcgi")
				.query({ db: "clinvar", term: "NONEXISTENT[Gene Name] OR NONEXISTENT[Title]", retmax: 10, retmode: "json" })
				.reply(200, { esearchresult: { idlist: [], count: "0" } });

			const result = await connector.search("NONEXISTENT");
			expect(result.ids).toEqual([]);
			expect(result.count).toBe(0);
		});
	});

	describe("fetchDetails", () => {
		it("parses variant details from esummary", async () => {
			nock("https://eutils.ncbi.nlm.nih.gov")
				.get("/entrez/eutils/esummary.fcgi")
				.query({ db: "clinvar", id: "17661", retmode: "json" })
				.reply(200, {
					result: {
						uids: ["17661"],
						17661: {
							uid: "17661",
							gene_sort: "BRCA1",
							clinical_significance: "Pathogenic",
							title: "NM_007294.4(BRCA1):c.68_69del (p.Glu23fs)",
							review_status: "criteria provided, multiple submitters, no conflicts",
						},
					},
				});

			const variants = await connector.fetchDetails(["17661"]);
			expect(variants).toHaveLength(1);
			expect(variants[0].variationId).toBe("17661");
			expect(variants[0].geneSymbol).toBe("BRCA1");
			expect(variants[0].clinicalSignificance).toBe("Pathogenic");
		});

		it("returns empty array for empty IDs", async () => {
			const variants = await connector.fetchDetails([]);
			expect(variants).toEqual([]);
		});
	});

	describe("error handling", () => {
		it("throws ConnectorError on HTTP error", async () => {
			nock("https://eutils.ncbi.nlm.nih.gov")
				.get("/entrez/eutils/esearch.fcgi")
				.query(true)
				.reply(503, "Service Unavailable");

			await expect(connector.search("BRCA1")).rejects.toThrow("HTTP 503");
		});
	});
});
