/**
 * BioTreLlises TUI Application — terminal interface for bioinformatics analysis.
 *
 * Layout (top to bottom):
 *   - Results panel (Markdown + Text components, scrollable history)
 *   - Status bar (1 line, current operation state)
 *   - Query editor (bottom, focused by default)
 */

import type { Agent } from "@mariozechner/pi-agent-core";
import {
	type Component,
	Container,
	Editor,
	Markdown,
	type OverlayAnchor,
	type OverlayHandle,
	ProcessTerminal,
	Text,
	TUI,
} from "@mariozechner/pi-tui";
import type { BioAgent } from "../agent/bio-agent.js";
import type { Aggregator } from "../reasoning/aggregator.js";
import type { Executor } from "../reasoning/executor.js";
import type { Planner } from "../reasoning/planner.js";
import type { BioToolRegistry } from "../registry.js";
import { getBioEditorTheme, getBioMarkdownTheme } from "./theme.js";

/** Status values for the status bar. */
export type BioTuiStatus = "idle" | "planning" | "executing" | "aggregating" | "error";

/** Options for creating BioTuiApp. */
export interface BioTuiAppOptions {
	/** Agent instance to run queries against. */
	agent: Agent;
	/** Optional initial welcome message (markdown). */
	welcomeMessage?: string;
	/** Optional status change callback. */
	onStatusChange?: (status: BioTuiStatus) => void;
	/** LLM-driven reasoning pipeline (optional — falls back to direct agent.prompt). */
	pipeline?: BioTuiPipeline;
}

/** Reasoning pipeline components for the TUI. */
export interface BioTuiPipeline {
	planner: Planner;
	executor: Executor;
	aggregator: Aggregator;
	registry: BioToolRegistry;
}

/**
 * BioTuiApp manages the full terminal UI lifecycle for BioTreLlises.
 *
 * Usage:
 *   const app = new BioTuiApp({ agent });
 *   await app.start();
 */
export class BioTuiApp {
	readonly tui: TUI;
	readonly editor: Editor;
	private readonly agent: Agent;
	private readonly resultsContainer: Container;
	private readonly editorContainer: Container;
	private readonly statusText: Text;
	private readonly pipeline?: BioTuiPipeline;
	private currentStatus: BioTuiStatus = "idle";
	private overlayHandle?: OverlayHandle;

	constructor(options: BioTuiAppOptions) {
		this.agent = options.agent;
		this.pipeline = options.pipeline;
		this.tui = new TUI(new ProcessTerminal());
		this.tui.setClearOnShrink(true);

		// Results panel — holds Markdown and Text components
		this.resultsContainer = new Container();

		// Status bar — single line at bottom above editor
		this.statusText = new Text(this.formatStatus("idle"), 1, 0);

		// Query editor — bottom panel
		this.editor = new Editor(this.tui, getBioEditorTheme(), { paddingX: 1 });
		this.editor.onSubmit = (text) => this.handleSubmit(text);

		this.editorContainer = new Container();
		this.editorContainer.addChild(this.editor as Component);

		// Assemble layout: results → status → editor
		this.tui.addChild(this.resultsContainer);
		this.tui.addChild(this.statusText);
		this.tui.addChild(this.editorContainer);
		this.tui.setFocus(this.editor as Component);

		// Show welcome message if provided
		if (options.welcomeMessage) {
			this.appendMarkdown(options.welcomeMessage);
		}
	}

	/** Start the TUI event loop. Blocks until stop() is called. */
	start(): void {
		this.tui.start();
	}

	/** Stop the TUI and restore terminal state. */
	stop(): void {
		this.tui.stop();
	}

	/** Get current status. */
	getStatus(): BioTuiStatus {
		return this.currentStatus;
	}

	/** Set status bar text and internal state. */
	setStatus(status: BioTuiStatus, detail?: string): void {
		this.currentStatus = status;
		this.statusText.setText(this.formatStatus(status, detail));
		this.tui.requestRender();
	}

	/** Append a markdown block to the results panel. */
	appendMarkdown(text: string): void {
		if (this.resultsContainer.children.length > 0) {
			this.resultsContainer.addChild(new Spacer(1));
		}
		this.resultsContainer.addChild(new Markdown(text.trim(), 1, 0, getBioMarkdownTheme()));
		this.tui.requestRender();
	}

	/** Append plain text to the results panel. */
	appendText(text: string): void {
		if (this.resultsContainer.children.length > 0) {
			this.resultsContainer.addChild(new Spacer(1));
		}
		this.resultsContainer.addChild(new Text(text, 1, 0));
		this.tui.requestRender();
	}

	/** Clear all results. */
	clearResults(): void {
		this.resultsContainer.clear();
		this.tui.requestRender();
	}

	/** Show a temporary overlay message. */
	showOverlay(component: Component, width?: number, anchor?: OverlayAnchor): OverlayHandle {
		this.overlayHandle = this.tui.showOverlay(component, {
			width: width ?? "60%",
			anchor: anchor ?? "center",
		});
		return this.overlayHandle;
	}

	/** Hide the current overlay if any. */
	hideOverlay(): void {
		this.overlayHandle?.hide();
		this.overlayHandle = undefined;
	}

	private async handleSubmit(text: string): Promise<void> {
		const query = text.trim();
		if (!query) return;

		this.appendText(`**Query:** ${query}`);
		this.editor.disableSubmit = true;

		try {
			if (this.pipeline) {
				await this.runPipeline(query);
			} else {
				await this.runDirectPrompt(query);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.setStatus("error", message);
			this.appendText(`Error: ${message}`);
		} finally {
			this.editor.disableSubmit = false;
			this.editor.setText("");
			this.tui.setFocus(this.editor as Component);
		}
	}

	/** Run the full reasoning pipeline: Plan → Execute → Aggregate. */
	private async runPipeline(query: string): Promise<void> {
		const { planner, executor, aggregator, registry } = this.pipeline!;

		// Phase 1: Plan
		this.setStatus("planning");
		const plan = await planner.plan(query, registry);
		this.appendText(`_Decomposition:_ ${plan.reasoning}`);

		// Phase 2: Execute
		this.setStatus("executing", `${plan.subProblems.length} sub-problem(s)`);
		const results = await executor.execute(plan, this.agent as BioAgent);

		for (const result of results) {
			if (result.success && result.output) {
				this.appendText(
					`**${result.subProblemId}** (${result.durationMs}ms): ${result.output.slice(0, 300)}${result.output.length > 300 ? "..." : ""}`,
				);
			} else if (!result.success) {
				this.appendText(`**${result.subProblemId}** [error]: ${result.error ?? "Unknown"}`);
			}
		}

		// Phase 3: Aggregate
		this.setStatus("aggregating");
		const report = await aggregator.aggregate(results, query);

		const reportLines = [
			`## Analysis Report`,
			``,
			`**Confidence:** ${report.confidence}`,
			``,
			`### Summary`,
			report.summary,
			``,
			`### Findings`,
			...report.findings.map((f) => `- ${f}`),
		];
		if (report.sources.length > 0) {
			reportLines.push(``, `### Sources`, ...report.sources.map((s) => `- ${s}`));
		}
		this.appendMarkdown(reportLines.join("\n"));
		this.setStatus("idle");
	}

	/** Direct agent prompt — fallback when no pipeline is configured. */
	private async runDirectPrompt(query: string): Promise<void> {
		this.setStatus("planning");

		const unsub = this.agent.subscribe((event) => {
			switch (event.type) {
				case "agent_start":
					this.setStatus("executing", "running tools...");
					break;
				case "tool_execution_start":
					this.setStatus("executing", `tool: ${event.toolName}`);
					break;
				case "tool_execution_end": {
					const result = event.result;
					if (result && typeof result === "object" && "content" in result) {
						const content = (result as { content?: Array<{ type: string; text?: string }> }).content;
						const textPart = content?.find((c) => c.type === "text");
						if (textPart?.text) {
							this.appendText(
								`_${event.toolName}_: ${textPart.text.slice(0, 200)}${textPart.text.length > 200 ? "..." : ""}`,
							);
						}
					}
					break;
				}
				case "agent_end":
					this.setStatus("aggregating");
					break;
				case "message_end": {
					const msg = event.message;
					if (msg && msg.role === "assistant" && typeof msg.content === "string") {
						this.appendMarkdown(msg.content);
					}
					break;
				}
			}
		});

		await this.agent.prompt(query);
		unsub();
		this.setStatus("idle");
	}

	private formatStatus(status: BioTuiStatus, detail?: string): string {
		const prefix = "\x1b[90m[BioTreLlises]\x1b[39m";
		switch (status) {
			case "idle":
				return `${prefix} Ready — type a query and press Enter`;
			case "planning":
				return `${prefix} \x1b[33mPlanning...\x1b[39m ${detail ?? ""}`;
			case "executing":
				return `${prefix} \x1b[36mExecuting...\x1b[39m ${detail ?? ""}`;
			case "aggregating":
				return `${prefix} \x1b[35mAggregating...\x1b[39m ${detail ?? ""}`;
			case "error":
				return `${prefix} \x1b[31mError:\x1b[39m ${detail ?? ""}`;
		}
	}
}

/** Minimal spacer component for separating result blocks. */
class Spacer implements Component {
	private lines: number;
	constructor(lines: number = 1) {
		this.lines = lines;
	}
	invalidate(): void {}
	render(_width: number): string[] {
		return Array.from({ length: this.lines }, () => "");
	}
}
