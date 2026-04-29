/**
 * BioToolRegistry — central registry for bioinformatics tools.
 *
 * Manages tool registration, categorization, and discovery.
 * Each tool is an AgentTool with an associated category for filtering.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { TSchema } from "typebox";

/** Tool categories for biological domain organization. */
export type ToolCategory = "sequence" | "structure" | "pathway" | "literature" | "disease";

/** Extended tool interface that includes a biological category. */
export interface BioAgentTool<TParameters extends TSchema = TSchema, TDetails = unknown>
	extends AgentTool<TParameters, TDetails> {
	/** Biological domain category for tool filtering. */
	category: ToolCategory;
}

/** Central registry for bioinformatics tools. */
export interface BioToolRegistry {
	/** Register a tool. Overwrites existing tool with the same name. */
	register(tool: BioAgentTool): void;

	/** Get all registered tools. */
	getAll(): BioAgentTool[];

	/** Get tools by biological category. */
	getByCategory(category: ToolCategory): BioAgentTool[];

	/** Suggest tools based on a description string (keyword matching). */
	suggest(description: string): BioAgentTool[];

	/** Get a single tool by its exact name. */
	getByName(name: string): BioAgentTool | undefined;
}

/** Default implementation of BioToolRegistry. */
export class DefaultBioToolRegistry implements BioToolRegistry {
	private tools = new Map<string, BioAgentTool>();

	register(tool: BioAgentTool): void {
		this.tools.set(tool.name, tool);
	}

	getAll(): BioAgentTool[] {
		return Array.from(this.tools.values());
	}

	getByCategory(category: ToolCategory): BioAgentTool[] {
		return this.getAll().filter((tool) => tool.category === category);
	}

	suggest(description: string): BioAgentTool[] {
		const keywords = description.toLowerCase().split(/\s+/);
		return this.getAll().filter((tool) => {
			const haystack = `${tool.name} ${tool.label} ${tool.description} ${tool.category}`.toLowerCase();
			return keywords.some((kw) => haystack.includes(kw));
		});
	}

	getByName(name: string): BioAgentTool | undefined {
		return this.tools.get(name);
	}
}
