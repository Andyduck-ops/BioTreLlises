/**
 * Unit tests for UniprotConnector.
 */

import nock from "nock";
import { beforeEach, describe, expect, it } from "vitest";
import { UniprotConnector } from "../../src/connectors/uniprot.js";

describe("UniprotConnector", () => {
	let connector: UniprotConnector;

	beforeEach(() => {
		connector = new UniprotConnector();
		nock.cleanAll();
	});

	describe("search", () => {
		it("should return protein search results", async () => {
			nock("https://rest.uniprot.org")
				.get("/uniprotkb/search")
				.query({
					query: "gene:TP53 AND organism_id:9606",
					size: 10,
					format: "json",
					fields: "accession,id,gene_names,organism_name,length",
				})
				.reply(200, {
					results: [
						{
							primaryAccession: "P04637",
							proteinDescription: {
								recommendedName: {
									fullName: { value: "Cellular tumor antigen p53" },
								},
							},
							genes: [{ geneName: { value: "TP53" } }],
							organism: { scientificName: "Homo sapiens" },
							sequence: { length: 393 },
						},
					],
				});

			const result = await connector.search("gene:TP53 AND organism_id:9606");
			expect(result.results).toHaveLength(1);
			expect(result.results[0].primaryAccession).toBe("P04637");
		});

		it("should cap size at 25", async () => {
			nock("https://rest.uniprot.org")
				.get("/uniprotkb/search")
				.query({
					query: "kinase",
					size: 25,
					format: "json",
					fields: "accession,id,gene_names,organism_name,length",
				})
				.reply(200, { results: [] });

			await connector.search("kinase", 100);
		});
	});

	describe("getEntry", () => {
		it("should return full protein entry", async () => {
			nock("https://rest.uniprot.org")
				.get("/uniprotkb/P04637")
				.query({ format: "json" })
				.reply(200, {
					primaryAccession: "P04637",
					sequence: { length: 393, molWeight: 43653 },
					comments: [{ commentType: "FUNCTION", texts: [{ value: "Acts as a tumor suppressor" }] }],
				});

			const entry = await connector.getEntry("P04637");
			expect(entry.primaryAccession).toBe("P04637");
			expect(entry.sequence?.length).toBe(393);
		});
	});

	describe("error handling", () => {
		it("should throw on HTTP 404", async () => {
			nock("https://rest.uniprot.org").get("/uniprotkb/INVALID").query({ format: "json" }).reply(404);

			await expect(connector.getEntry("INVALID")).rejects.toThrow("HTTP 404");
		});
	});
});
