/**
 * Bio Reasoning Aggregator — synthesizes sub-problem results into a coherent report.
 *
 * Two strategies available:
 * - LLMAggregator: uses LLM reasoning for intelligent synthesis (primary)
 * - SimpleAggregator: formats results with regex-based extraction (fallback)
 */

import type { BioAgent } from "../agent/bio-agent.js";
import type { SubProblemResult } from "./executor.js";

/** Cross-source consistency assessment. */
export interface ConsistencyReport {
	/** Conflicting claims found across different sources. */
	conflicts: string[];
	/** Agreements or corroborating findings across sources. */
	agreements: string[];
}

/** Final analysis report. */
export interface AnalysisReport {
	/** Concise summary of findings. */
	summary: string;
	/** Bullet-point findings from each sub-problem. */
	findings: string[];
	/** Overall confidence based on result coverage. */
	confidence: "high" | "medium" | "low";
	/** Citations / sources referenced. */
	sources: string[];
	/** Cross-source consistency check results. */
	consistency?: ConsistencyReport;
}

/** Interface for result aggregation strategies. */
export interface Aggregator {
	/**
	 * Aggregate sub-problem results into a final report.
	 *
	 * @param results - Results from each sub-problem execution.
	 * @param originalQuery - The original user query.
	 */
	aggregate(results: SubProblemResult[], originalQuery: string): Promise<AnalysisReport>;
}

// ── SimpleAggregator ───────────────────────────────────────────────────────

/** Formats results into a structured report using regex-based extraction. */
export class SimpleAggregator implements Aggregator {
	async aggregate(results: SubProblemResult[], originalQuery: string): Promise<AnalysisReport> {
		const successful = results.filter((r) => r.success);
		const failed = results.filter((r) => !r.success);

		const findings: string[] = [];
		const sources: string[] = [];

		for (const result of successful) {
			if (result.output) {
				// Split output into lines and add as findings
				const lines = result.output
					.split("\n")
					.map((l) => l.trim())
					.filter((l) => l.length > 0 && !l.startsWith("(") && l !== "(No output generated)");
				findings.push(...lines.slice(0, 20));
			}
			// Track sources (PMIDs, UniProt IDs, gene symbols) with simple regex
			const pmids = this.extractPmids(result.output);
			const accessions = this.extractAccessions(result.output);
			sources.push(...pmids, ...accessions);
		}

		for (const result of failed) {
			findings.push(`[Error in ${result.subProblemId}]: ${result.error ?? "Unknown error"}`);
		}

		// Deduplicate sources
		const uniqueSources = [...new Set(sources)];

		// Confidence based on coverage
		const coverage = successful.length / results.length;
		let confidence: AnalysisReport["confidence"];
		if (coverage >= 0.8 && failed.length === 0) confidence = "high";
		else if (coverage >= 0.5) confidence = "medium";
		else confidence = "low";

		const summary = this.generateSummary(originalQuery, successful, failed, uniqueSources);
		const consistency = this.extractConsistency(successful);

		return {
			summary,
			findings,
			confidence,
			sources: uniqueSources,
			consistency,
		};
	}

	private generateSummary(
		query: string,
		successful: SubProblemResult[],
		failed: SubProblemResult[],
		sources: string[],
	): string {
		let text = `Analysis of "${query}": `;
		text += `${successful.length} sub-problem(s) completed successfully`;
		if (failed.length > 0) {
			text += `, ${failed.length} failed`;
		}
		text += `. `;
		if (sources.length > 0) {
			text += `Referenced ${sources.length} source(s). `;
		}
		if (failed.length > 0) {
			text += `Review errors for incomplete areas.`;
		} else {
			text += `Results are ready for review below.`;
		}
		return text;
	}

	private extractPmids(text: string): string[] {
		const matches = text.match(/PMID:\s*(\d+)/gi);
		return matches ? matches.map((m) => m.trim()) : [];
	}

	private extractAccessions(text: string): string[] {
		const matches = text.match(/UniProt ID:\s*([A-Z]\d[A-Z\d]{3,})/gi);
		return matches ? matches.map((m) => m.trim()) : [];
	}

	/** Extract basic consistency markers from result text. */
	private extractConsistency(results: SubProblemResult[]): ConsistencyReport {
		const conflicts: string[] = [];
		const agreements: string[] = [];

		// Look for explicit conflict/agreement markers in outputs
		for (const result of results) {
			if (!result.output) continue;
			const conflictMatches = result.output.match(/(?:conflict|discrepancy|contradict|inconsistent|mismatch)[^\n.]*/gi);
			if (conflictMatches) {
				conflicts.push(...conflictMatches.map((m) => m.trim()));
			}
			const agreeMatches = result.output.match(/(?:agree|consistent|confirm|support|corroborate)[^\n.]*/gi);
			if (agreeMatches) {
				agreements.push(...agreeMatches.map((m) => m.trim()));
			}
		}

		return {
			conflicts: [...new Set(conflicts)].slice(0, 10),
			agreements: [...new Set(agreements)].slice(0, 10),
		};
	}
}

/** @deprecated Use {@link SimpleAggregator} instead. */
export { SimpleAggregator as DefaultAggregator };

// ── LLMAggregator ──────────────────────────────────────────────────────────

/** LLM-driven aggregator that uses a sub-agent to synthesize findings. */
export class LLMAggregator implements Aggregator {
	private readonly fallback: Aggregator;

	/**
	 * @param agent - Parent BioAgent used to create reasoning sub-agents.
	 * @param fallback - Fallback aggregator used when LLM parsing fails (defaults to SimpleAggregator).
	 */
	constructor(
		private readonly agent: BioAgent,
		fallback?: Aggregator,
	) {
		this.fallback = fallback ?? new SimpleAggregator();
	}

	async aggregate(results: SubProblemResult[], originalQuery: string): Promise<AnalysisReport> {
		try {
			return await this.llmAggregate(results, originalQuery);
		} catch {
			// On any error (LLM failure, JSON parse failure), fall back
			return this.fallback.aggregate(results, originalQuery);
		}
	}

	/** Ask the LLM to synthesize results into an AnalysisReport. */
	private async llmAggregate(results: SubProblemResult[], originalQuery: string): Promise<AnalysisReport> {
		const prompt = this.buildAggregationPrompt(results, originalQuery);

		// Create a sub-agent with no tools — it only needs reasoning
		const subAgent = this.agent.createSubAgent("aggregator", []);

		const outputs: string[] = [];
		const unsub = subAgent.subscribe((event) => {
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

		await subAgent.prompt(prompt);
		await subAgent.waitForIdle();
		unsub();

		const rawText = outputs.join("").trim();
		return this.parseReportJson(rawText, results);
	}

	/** Build the aggregation prompt with all sub-problem results and output format. */
	private buildAggregationPrompt(results: SubProblemResult[], originalQuery: string): string {
		const resultSummaries = results
			.map((r) => {
				const status = r.success ? "success" : "error";
				const detail = r.success ? r.output : (r.error ?? "Unknown error");
				// Truncate very long outputs to keep prompt manageable
				const truncated = detail.length > 1000 ? `${detail.slice(0, 1000)}...` : detail;
				return `  - ${r.subProblemId} [${status}]: ${truncated}`;
			})
			.join("\n");

		return `You are a bioinformatics analysis aggregator. Synthesize the following sub-problem results into a coherent analysis report. Cross-check findings from different sources for consistency.

Original query: ${originalQuery}

Sub-problem results:
${resultSummaries}

Output a JSON object with this exact structure:
{
  "summary": "concise 2-3 sentence synthesis of all findings",
  "findings": ["finding 1", "finding 2", "..."],
  "confidence": "high",
  "sources": ["source1", "source2", "..."],
  "consistency": {
    "conflicts": ["any contradictory claims across sources", "..."],
    "agreements": ["corroborating findings across sources", "..."]
  }
}

Rules:
1. summary should synthesize across all results, not just list them
2. findings should be 3-8 concise bullet-point observations
3. confidence must be "high", "medium", or "low" based on result coverage and coherence
4. sources should list PMIDs, UniProt IDs, or other identifiers found in results
5. consistency.conflicts: list any contradictory or inconsistent claims found across different data sources
6. consistency.agreements: list findings that are corroborated or confirmed by multiple independent sources
7. Do not fabricate data — only report what is present in the results

Respond with ONLY the JSON object, no other text.`;
	}

	/** Parse LLM JSON output into an AnalysisReport. Throws on invalid output to trigger fallback. */
	private parseReportJson(raw: string, results: SubProblemResult[]): AnalysisReport {
		// Strip markdown code blocks if present
		let json = raw;
		const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
		if (codeBlockMatch) {
			json = codeBlockMatch[1];
		}

		const parsed = JSON.parse(json) as Record<string, unknown>;

		const summary: string =
			typeof parsed.summary === "string" && parsed.summary.length > 0
				? parsed.summary
				: `Analysis of ${results.length} sub-problem(s).`;

		const findings: string[] = Array.isArray(parsed.findings)
			? parsed.findings.filter((f): f is string => typeof f === "string" && f.length > 0)
			: [];

		const validConfidences = new Set<string>(["high", "medium", "low"]);
		const confidence: AnalysisReport["confidence"] = validConfidences.has(String(parsed.confidence))
			? (parsed.confidence as AnalysisReport["confidence"])
			: "medium";

		const sources: string[] = Array.isArray(parsed.sources)
			? parsed.sources.filter((s): s is string => typeof s === "string" && s.length > 0)
			: [];

		// Parse cross-source consistency
		let consistency: ConsistencyReport | undefined;
		if (parsed.consistency && typeof parsed.consistency === "object") {
			const c = parsed.consistency as Record<string, unknown>;
			const conflicts = Array.isArray(c.conflicts)
				? c.conflicts.filter((x): x is string => typeof x === "string")
				: [];
			const agreements = Array.isArray(c.agreements)
				? c.agreements.filter((x): x is string => typeof x === "string")
				: [];
			if (conflicts.length > 0 || agreements.length > 0) {
				consistency = { conflicts, agreements };
			}
		}

		return { summary, findings, confidence, sources, consistency };
	}
}
