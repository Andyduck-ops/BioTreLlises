/**
 * Multi-model strategy for BioTreLlises.
 *
 * Routes different agent roles to appropriate LLM models based on
 * task requirements (reasoning, speed, context length, cost).
 *
 * | Role | Criteria | Example Models |
 * |------|----------|----------------|
 * | Planner | Strong reasoning, structured output | claude-sonnet-4, gpt-5, gemini-2.5-pro |
 * | Executor | Good tool calling, fast | gpt-4o-mini, claude-haiku-4, gemini-2.5-flash |
 * | Aggregator | Long context, structured output | claude-sonnet-4, gemini-2.5-pro |
 * | Simple | Fast and cheap | gpt-4o-mini |
 */

import type { Model } from "@mariozechner/pi-ai";

/** Agent role that determines model selection. */
export type AgentRole = "planner" | "executor" | "aggregator" | "simple";

/** Model selection criteria for a given role. */
export interface ModelCriteria {
	/** Preferred model IDs in priority order. */
	preferredModels: string[];
	/** Minimum context window required (in tokens). */
	minContextWindow?: number;
	/** Whether reasoning/thinking capability is preferred. */
	preferReasoning?: boolean;
}

/** Strategy for selecting models based on agent role. */
export interface ModelStrategy {
	/** Select the best available model for a given role. */
	selectModel(role: AgentRole, availableModels: Model<any>[]): Model<any> | undefined;
	/** Get criteria for a role without performing selection. */
	getCriteria(role: AgentRole): ModelCriteria;
}

/** Default model selection criteria per role. */
const DEFAULT_CRITERIA: Record<AgentRole, ModelCriteria> = {
	planner: {
		preferredModels: ["claude-sonnet-4-20250514", "claude-sonnet-4", "gpt-5", "gemini-2.5-pro", "claude-opus-4"],
		minContextWindow: 128_000,
		preferReasoning: true,
	},
	executor: {
		preferredModels: ["gpt-4o-mini", "claude-haiku-4", "gemini-2.5-flash", "gpt-4o", "claude-sonnet-4"],
		minContextWindow: 32_000,
		preferReasoning: false,
	},
	aggregator: {
		preferredModels: ["claude-sonnet-4-20250514", "claude-sonnet-4", "gemini-2.5-pro", "gpt-5", "claude-opus-4"],
		minContextWindow: 200_000,
		preferReasoning: false,
	},
	simple: {
		preferredModels: ["gpt-4o-mini", "claude-haiku-4", "gemini-2.5-flash"],
		minContextWindow: 16_000,
		preferReasoning: false,
	},
};

/** Default implementation of ModelStrategy. */
export class DefaultModelStrategy implements ModelStrategy {
	private criteria: Record<AgentRole, ModelCriteria>;

	constructor(criteria?: Partial<Record<AgentRole, ModelCriteria>>) {
		this.criteria = {
			planner: criteria?.planner ?? DEFAULT_CRITERIA.planner,
			executor: criteria?.executor ?? DEFAULT_CRITERIA.executor,
			aggregator: criteria?.aggregator ?? DEFAULT_CRITERIA.aggregator,
			simple: criteria?.simple ?? DEFAULT_CRITERIA.simple,
		};
	}

	getCriteria(role: AgentRole): ModelCriteria {
		return this.criteria[role];
	}

	selectModel(role: AgentRole, availableModels: Model<any>[]): Model<any> | undefined {
		const criteria = this.criteria[role];

		// Filter by minimum context window
		let candidates = availableModels;
		const minContext = criteria.minContextWindow;
		if (minContext !== undefined && minContext > 0) {
			candidates = candidates.filter((m) => m.contextWindow >= minContext);
		}

		// If reasoning is preferred, boost reasoning models
		if (criteria.preferReasoning) {
			const reasoningModels = candidates.filter((m) => m.reasoning);
			if (reasoningModels.length > 0) {
				candidates = reasoningModels;
			}
		}

		// Match by preferred model IDs in priority order
		for (const preferredId of criteria.preferredModels) {
			const match = candidates.find((m) => m.id === preferredId || m.id.startsWith(preferredId));
			if (match) return match;
		}

		// Fallback: return first candidate that meets criteria
		return candidates[0];
	}
}
