/**
 * Unit tests for BioToolRegistry.
 */

import { Type } from "@mariozechner/pi-ai";
import { beforeEach, describe, expect, it } from "vitest";
import { type BioAgentTool, DefaultBioToolRegistry, type ToolCategory } from "../src/registry.js";

function createMockTool(name: string, label: string, category: ToolCategory): BioAgentTool {
	return {
		name,
		label,
		category,
		description: `Mock tool: ${label}`,
		parameters: Type.Object({}),
		execute: async () => ({ content: [{ type: "text", text: "ok" }], details: {} }),
	};
}

describe("DefaultBioToolRegistry", () => {
	let registry: DefaultBioToolRegistry;

	beforeEach(() => {
		registry = new DefaultBioToolRegistry();
	});

	it("should register and retrieve a tool by name", () => {
		const tool = createMockTool("test_tool", "Test Tool", "sequence");
		registry.register(tool);

		expect(registry.getByName("test_tool")).toBe(tool);
	});

	it("should return all registered tools", () => {
		const t1 = createMockTool("tool_a", "Tool A", "sequence");
		const t2 = createMockTool("tool_b", "Tool B", "structure");
		registry.register(t1);
		registry.register(t2);

		const all = registry.getAll();
		expect(all).toHaveLength(2);
		expect(all.map((t) => t.name)).toContain("tool_a");
		expect(all.map((t) => t.name)).toContain("tool_b");
	});

	it("should filter tools by category", () => {
		const t1 = createMockTool("gene_search", "Gene Search", "sequence");
		const t2 = createMockTool("protein_info", "Protein Info", "structure");
		const t3 = createMockTool("pubmed_search", "PubMed Search", "literature");
		registry.register(t1);
		registry.register(t2);
		registry.register(t3);

		const sequenceTools = registry.getByCategory("sequence");
		expect(sequenceTools).toHaveLength(1);
		expect(sequenceTools[0].name).toBe("gene_search");

		const litTools = registry.getByCategory("literature");
		expect(litTools).toHaveLength(1);
		expect(litTools[0].name).toBe("pubmed_search");
	});

	it("should suggest tools based on description keywords", () => {
		const t1 = createMockTool("gene_search", "Gene Search", "sequence");
		const t2 = createMockTool("protein_info", "Protein Info", "structure");
		registry.register(t1);
		registry.register(t2);

		// "gene" matches tool name "gene_search"
		const suggested = registry.suggest("gene");
		expect(suggested.map((t) => t.name)).toContain("gene_search");

		// "protein" matches tool name "protein_info"
		const proteinSuggested = registry.suggest("protein");
		expect(proteinSuggested.map((t) => t.name)).toContain("protein_info");
	});

	it("should overwrite tool with the same name", () => {
		const t1 = createMockTool("same", "Original", "sequence");
		const t2 = createMockTool("same", "Overwritten", "structure");
		registry.register(t1);
		registry.register(t2);

		const retrieved = registry.getByName("same");
		expect(retrieved?.label).toBe("Overwritten");
		expect(retrieved?.category).toBe("structure");
	});

	it("should return undefined for unknown tool name", () => {
		expect(registry.getByName("nonexistent")).toBeUndefined();
	});

	it("should return empty array for category with no tools", () => {
		expect(registry.getByCategory("disease")).toEqual([]);
	});
});
