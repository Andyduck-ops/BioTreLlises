/**
 * Mock bioinformatics tools for parallel development.
 * These tools return hardcoded but realistic data,
 * allowing the reasoning engine and TUI to be developed
 * before real connectors are implemented.
 */

export { mockDiseaseLinkTool } from "./disease-link.js";
export { mockGeneSearchTool } from "./gene-search.js";
export { mockPathwayEnrichTool } from "./pathway-enrich.js";
export { mockProteinInfoTool } from "./protein-info.js";
export { mockPubMedSearchTool } from "./pubmed-search.js";
