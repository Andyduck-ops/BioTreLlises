/**
 * BioAgent — specialized agent for bioinformatics analysis.
 *
 * Wraps pi-agent-core's Agent with:
 * - Bio domain system prompt
 * - BioToolRegistry integration
 * - Multi-model strategy support
 */

import { Agent, type AgentOptions, type AgentState } from "@mariozechner/pi-agent-core";
import type { BioToolRegistry } from "../registry.js";
import { type AgentRole, DefaultModelStrategy, type ModelStrategy } from "./model-strategy.js";
import { BIO_SYSTEM_PROMPT } from "./system-prompt.js";

/** Configuration options for BioAgent. */
export interface BioAgentOptions extends Omit<AgentOptions, "initialState"> {
	/** Bio tool registry with bioinformatics tools. */
	registry: BioToolRegistry;
	/** Optional custom system prompt (defaults to BIO_SYSTEM_PROMPT). */
	systemPrompt?: string;
	/** Optional model strategy (defaults to DefaultModelStrategy). */
	modelStrategy?: ModelStrategy;
	/** Optional initial agent state (merged with bio defaults). */
	initialState?: Partial<Omit<AgentState, "pendingToolCalls" | "isStreaming" | "streamingMessage" | "errorMessage">>;
}

/** BioAgent wraps pi-agent-core Agent with bioinformatics domain configuration. */
export class BioAgent extends Agent {
	/** The bio tool registry used by this agent. */
	readonly registry: BioToolRegistry;
	/** The model strategy for role-based model selection. */
	readonly modelStrategy: ModelStrategy;
	/** The bio domain system prompt. */
	readonly bioSystemPrompt: string;

	constructor(options: BioAgentOptions) {
		const bioSystemPrompt = options.systemPrompt ?? BIO_SYSTEM_PROMPT;
		const registry = options.registry;
		const tools = registry.getAll();

		super({
			...options,
			initialState: {
				systemPrompt: bioSystemPrompt,
				...options.initialState,
				tools: [...tools, ...(options.initialState?.tools ?? [])],
			},
		});

		this.registry = registry;
		this.modelStrategy = options.modelStrategy ?? new DefaultModelStrategy();
		this.bioSystemPrompt = bioSystemPrompt;
	}

	/**
	 * Get tools filtered by biological category.
	 * Useful for sub-problem execution with limited tool sets.
	 */
	getToolsByCategory(
		category: Parameters<BioToolRegistry["getByCategory"]>[0],
	): ReturnType<BioToolRegistry["getByCategory"]> {
		return this.registry.getByCategory(category);
	}

	/**
	 * Suggest tools based on a natural language description.
	 * Useful for the planner to match sub-problems to tools.
	 */
	suggestTools(description: string): ReturnType<BioToolRegistry["suggest"]> {
		return this.registry.suggest(description);
	}

	/**
	 * Create a new Agent instance configured for a specific role.
	 * The sub-agent inherits the bio system prompt but uses a subset of tools.
	 *
	 * @param role - The agent role (planner, executor, aggregator, simple)
	 * @param toolNames - Optional specific tool names to include (defaults to all)
	 * @returns A new BioAgent configured for the role
	 */
	createSubAgent(_role: AgentRole, toolNames?: string[]): BioAgent {
		const tools = toolNames
			? toolNames
					.map((name) => this.registry.getByName(name))
					.filter((t): t is NonNullable<typeof t> => t !== undefined)
			: this.registry.getAll();

		return new BioAgent({
			registry: {
				register: () => {},
				getAll: () => tools,
				getByCategory: (cat) => tools.filter((t) => t.category === cat),
				suggest: (desc) => this.registry.suggest(desc).filter((t) => tools.includes(t)),
				getByName: (name) => tools.find((t) => t.name === name),
			},
			systemPrompt: this.bioSystemPrompt,
			modelStrategy: this.modelStrategy,
			initialState: {
				model: this.state.model,
				thinkingLevel: this.state.thinkingLevel,
			},
		});
	}
}
