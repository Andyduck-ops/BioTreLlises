/**
 * Unit tests for BioAgent.
 */

import { Type } from "@mariozechner/pi-ai";
import { beforeEach, describe, expect, it } from "vitest";
import { BioAgent } from "../src/agent/bio-agent.js";
import { BIO_SYSTEM_PROMPT } from "../src/agent/system-prompt.js";
import { type BioAgentTool, DefaultBioToolRegistry } from "../src/registry.js";

function createMockTool(name: string, label: string, category: "sequence" | "structure" | "literature"): BioAgentTool {
	return {
		name,
		label,
		category,
		description: `Mock tool: ${label}`,
		parameters: Type.Object({}),
		execute: async () => ({ content: [{ type: "text", text: "ok" }], details: {} }),
	};
}

describe("BioAgent", () => {
	let registry: DefaultBioToolRegistry;

	beforeEach(() => {
		registry = new DefaultBioToolRegistry();
		registry.register(createMockTool("gene_search", "Gene Search", "sequence"));
		registry.register(createMockTool("protein_info", "Protein Info", "structure"));
		registry.register(createMockTool("pubmed_search", "PubMed Search", "literature"));
	});

	it("should initialize with bio system prompt", () => {
		const agent = new BioAgent({ registry });
		expect(agent.bioSystemPrompt).toBe(BIO_SYSTEM_PROMPT);
		expect(agent.state.systemPrompt).toBe(BIO_SYSTEM_PROMPT);
	});

	it("should load all registry tools into state", () => {
		const agent = new BioAgent({ registry });
		expect(agent.state.tools).toHaveLength(3);
		expect(agent.state.tools.map((t) => t.name)).toContain("gene_search");
		expect(agent.state.tools.map((t) => t.name)).toContain("protein_info");
		expect(agent.state.tools.map((t) => t.name)).toContain("pubmed_search");
	});

	it("should allow custom system prompt", () => {
		const customPrompt = "Custom bio prompt";
		const agent = new BioAgent({ registry, systemPrompt: customPrompt });
		expect(agent.bioSystemPrompt).toBe(customPrompt);
		expect(agent.state.systemPrompt).toBe(customPrompt);
	});

	it("should get tools by category", () => {
		const agent = new BioAgent({ registry });
		const sequenceTools = agent.getToolsByCategory("sequence");
		expect(sequenceTools).toHaveLength(1);
		expect(sequenceTools[0].name).toBe("gene_search");
	});

	it("should suggest tools", () => {
		const agent = new BioAgent({ registry });
		const suggested = agent.suggestTools("gene");
		expect(suggested.map((t) => t.name)).toContain("gene_search");
	});

	it("should create a sub-agent with subset of tools", () => {
		const agent = new BioAgent({ registry });
		const subAgent = agent.createSubAgent("executor", ["gene_search", "pubmed_search"]);

		expect(subAgent.state.tools).toHaveLength(2);
		expect(subAgent.state.tools.map((t) => t.name)).toContain("gene_search");
		expect(subAgent.state.tools.map((t) => t.name)).toContain("pubmed_search");
		expect(subAgent.state.tools.map((t) => t.name)).not.toContain("protein_info");
	});

	it("should inherit system prompt in sub-agent", () => {
		const agent = new BioAgent({ registry });
		const subAgent = agent.createSubAgent("simple");
		expect(subAgent.state.systemPrompt).toBe(agent.state.systemPrompt);
	});
});
