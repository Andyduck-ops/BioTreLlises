/**
 * Unit tests for PubmedConnector.
 */

import nock from "nock";
import { beforeEach, describe, expect, it } from "vitest";
import { PubmedConnector } from "../../src/connectors/pubmed.js";

describe("PubmedConnector", () => {
	let connector: PubmedConnector;

	beforeEach(() => {
		connector = new PubmedConnector();
		nock.cleanAll();
	});

	describe("search", () => {
		it("should return PMIDs for a query", async () => {
			nock("https://eutils.ncbi.nlm.nih.gov")
				.get("/entrez/eutils/esearch.fcgi")
				.query({
					db: "pubmed",
					term: "CRISPR therapy",
					retmax: 10,
					retmode: "json",
				})
				.reply(200, {
					esearchresult: {
						idlist: ["33283989", "30804536"],
						count: "2",
					},
				});

			const result = await connector.search("CRISPR therapy");
			expect(result.ids).toEqual(["33283989", "30804536"]);
			expect(result.count).toBe(2);
		});

		it("should apply last5years date filter", async () => {
			const year = new Date().getFullYear() - 5;
			nock("https://eutils.ncbi.nlm.nih.gov")
				.get("/entrez/eutils/esearch.fcgi")
				.query({
					db: "pubmed",
					term: `cancer AND ${year}[PDAT]:3000[PDAT]`,
					retmax: 5,
					retmode: "json",
				})
				.reply(200, {
					esearchresult: { idlist: ["35012351"], count: "1" },
				});

			const result = await connector.search("cancer", 5, "last5years");
			expect(result.ids).toEqual(["35012351"]);
		});

		it("should apply year range date filter", async () => {
			nock("https://eutils.ncbi.nlm.nih.gov")
				.get("/entrez/eutils/esearch.fcgi")
				.query({
					db: "pubmed",
					term: "diabetes AND 2020:2024[PDAT]",
					retmax: 10,
					retmode: "json",
				})
				.reply(200, {
					esearchresult: { idlist: [], count: "0" },
				});

			const result = await connector.search("diabetes", 10, "2020:2024");
			expect(result.count).toBe(0);
		});
	});

	describe("fetchSummaries", () => {
		it("should parse article summaries", async () => {
			nock("https://eutils.ncbi.nlm.nih.gov")
				.get("/entrez/eutils/esummary.fcgi")
				.query({
					db: "pubmed",
					id: "33283989,30804536",
					retmode: "json",
				})
				.reply(200, {
					result: {
						uids: ["33283989", "30804536"],
						33283989: {
							uid: "33283989",
							title: "CRISPR-Cas9 gene editing for treatment of sickle cell disease",
							authors: [{ name: "Frangoul H" }],
							lastauthor: "Frangoul H",
							fulljournalname: "New England Journal of Medicine",
							source: "N Engl J Med",
							pubdate: "2021 Jan 21",
							abstract: "This study reports the safety and efficacy...",
						},
						30804536: {
							uid: "30804536",
							title: "Engineered CRISPR-Cas12a variants",
							lastauthor: "Kleinstiver BP",
							fulljournalname: "Nature Biotechnology",
							pubdate: "2019 Mar",
							abstract: "",
						},
					},
				});

			const articles = await connector.fetchSummaries(["33283989", "30804536"]);
			expect(articles).toHaveLength(2);
			expect(articles[0].pmid).toBe("33283989");
			expect(articles[0].title).toContain("CRISPR-Cas9");
			expect(articles[0].authors).toBe("Frangoul H");
			expect(articles[0].journal).toBe("New England Journal of Medicine");
			expect(articles[0].year).toBe("2021");
		});

		it("should return empty array for empty PMIDs", async () => {
			const articles = await connector.fetchSummaries([]);
			expect(articles).toEqual([]);
		});
	});
});
