/**
 * Bio Reasoning Executor — runs sub-problems in parallel where possible.
 */

import type { BioAgent } from "../agent/bio-agent.js";
import type { Plan, SubProblem } from "./planner.js";

/** Result of executing a single sub-problem. */
export interface SubProblemResult {
	/** Sub-problem ID. */
	subProblemId: string;
	/** Whether execution succeeded. */
	success: boolean;
	/** Text output from the sub-agent. */
	output: string;
	/** Error message if execution failed. */
	error?: string;
	/** Execution duration in milliseconds. */
	durationMs: number;
}

/** Interface for plan execution strategies. */
export interface Executor {
	/**
	 * Execute a plan using sub-agents derived from the parent agent.
	 *
	 * @param plan - The execution plan.
	 * @param agent - The parent BioAgent used to create sub-agents.
	 */
	execute(plan: Plan, agent: BioAgent): Promise<SubProblemResult[]>;
}

/** Default executor that runs independent sub-problems in parallel. */
export class DefaultExecutor implements Executor {
	async execute(plan: Plan, agent: BioAgent): Promise<SubProblemResult[]> {
		const results = new Map<string, SubProblemResult>();
		const completed = new Set<string>();

		// Group sub-problems by dependency level (topological layers)
		const layers = this.buildLayers(plan.subProblems);

		for (const layer of layers) {
			// Execute each layer in parallel
			const layerResults = await Promise.all(layer.map((sp) => this.runSubProblem(sp, agent)));

			for (const result of layerResults) {
				results.set(result.subProblemId, result);
				completed.add(result.subProblemId);
			}
		}

		// Return results in original plan order
		return plan.subProblems.map((sp) => results.get(sp.id)!);
	}

	/** Execute a single sub-problem using a sub-agent. */
	private async runSubProblem(subProblem: SubProblem, parentAgent: BioAgent): Promise<SubProblemResult> {
		const start = Date.now();

		try {
			// Collect tool names from the requested categories
			const tools = subProblem.toolCategories.flatMap((cat) => parentAgent.getToolsByCategory(cat));
			const toolNames = [...new Set(tools.map((t) => t.name))];

			// Create a sub-agent with only the relevant tools
			const subAgent = parentAgent.createSubAgent("executor", toolNames);

			// Gather output from the sub-agent's assistant messages
			const outputs: string[] = [];
			subAgent.subscribe((event) => {
				if (event.type === "message_end" && event.message.role === "assistant") {
					const content = event.message.content;
					const text = Array.isArray(content)
						? (content as Array<{ type: string; text?: string }>)
								.filter((c) => c.type === "text")
								.map((c) => c.text ?? "")
								.join("")
						: typeof content === "string"
							? content
							: "";
					if (text) outputs.push(text);
				}
			});

			// Run the sub-problem
			await subAgent.prompt(subProblem.goal);
			await subAgent.waitForIdle();

			const output = outputs.join("\n\n").trim() || "(No output generated)";

			return {
				subProblemId: subProblem.id,
				success: true,
				output,
				durationMs: Date.now() - start,
			};
		} catch (error) {
			return {
				subProblemId: subProblem.id,
				success: false,
				output: "",
				error: error instanceof Error ? error.message : String(error),
				durationMs: Date.now() - start,
			};
		}
	}

	/**
	 * Build topological layers from sub-problems.
	 * Each layer contains sub-problems whose dependencies are all satisfied by previous layers.
	 */
	private buildLayers(subProblems: SubProblem[]): SubProblem[][] {
		const remaining = new Set(subProblems);
		const completed = new Set<string>();
		const layers: SubProblem[][] = [];

		while (remaining.size > 0) {
			const layer: SubProblem[] = [];
			for (const sp of remaining) {
				if (sp.dependsOn.every((id) => completed.has(id))) {
					layer.push(sp);
				}
			}

			if (layer.length === 0) {
				// Circular dependency or orphaned dependency — run remaining together
				layers.push([...remaining]);
				break;
			}

			for (const sp of layer) {
				remaining.delete(sp);
				completed.add(sp.id);
			}
			layers.push(layer);
		}

		return layers;
	}
}
