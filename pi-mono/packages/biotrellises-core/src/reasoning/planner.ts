/**
 * Bio Reasoning Planner — decomposes user queries into parallel sub-problems.
 *
 * Two strategies available:
 * - LLMPlanner: uses LLM reasoning for intelligent decomposition (primary)
 * - KeywordPlanner: keyword-based intent detection with gene/protein symbol recognition (fallback)
 */

import type { BioAgent } from "../agent/bio-agent.js";
import type { BioToolRegistry, ToolCategory } from "../registry.js";

/** Valid tool categories for runtime validation. */
const VALID_CATEGORIES: readonly ToolCategory[] = ["sequence", "structure", "pathway", "literature", "disease"];

/** A single sub-problem in the execution plan. */
export interface SubProblem {
	/** Unique identifier for this sub-problem. */
	id: string;
	/** Natural language goal describing what this sub-problem should achieve. */
	goal: string;
	/** Tool categories needed to solve this sub-problem. */
	toolCategories: ToolCategory[];
	/** IDs of sub-problems that must complete before this one starts. */
	dependsOn: string[];
}

/** Execution plan produced by the planner. */
export interface Plan {
	/** Ordered list of sub-problems. */
	subProblems: SubProblem[];
	/** Human-readable reasoning about decomposition. */
	reasoning: string;
}

/** Interface for query decomposition strategies. */
export interface Planner {
	/**
	 * Decompose a user query into an execution plan.
	 *
	 * @param query - The user's natural language query.
	 * @param registry - Tool registry for suggesting relevant tools.
	 */
	plan(query: string, registry: BioToolRegistry): Promise<Plan>;
}

// ── Intent detection helpers ──────────────────────────────────────────────

/** Pattern to match known gene/protein symbols: 2-6 uppercase alphanumeric chars, optional trailing hyphen+digit. */
const GENE_SYMBOL_RE = /\b[A-Z][A-Z0-9]{1,5}(?:-\d+)?\b/;

/** Known false positives for GENE_SYMBOL_RE — common English/technical words that match the pattern. */
const FALSE_POSITIVES = new Set([
	"DNA",
	"RNA",
	"MRNA",
	"TRNA",
	"RRNA",
	"SNP",
	"PCR",
	"GPT",
	"API",
	"HTTP",
	"HTML",
	"JSON",
	"XML",
	"YAML",
	"CSV",
	"PDF",
	"CLI",
	"TUI",
	"LLM",
	"AI",
	"ID",
	"UID",
	"UUID",
	"URL",
	"URI",
	"CPU",
	"GPU",
	"RAM",
	"ROM",
	"BIOS",
	"USB",
	"HDMI",
	"SSH",
	"FTP",
	"TCP",
	"UDP",
	"IP",
	"GET",
	"SET",
	"PUT",
	"POST",
	"DEL",
	"TRUE",
	"FALSE",
	"NULL",
	"UNDEFINED",
	"APP",
	"BETA",
	"ALPHA",
	"MAIN",
	"TEST",
	"TODO",
	"FIXME",
	"HACK",
]);

// Intent keyword groups — matched against the lowercased query
interface IntentRule {
	name: ToolCategory;
	keywords: string[];
	/** Score boost when a gene symbol is also present in the query */
	symbolBonus: boolean;
}

const INTENT_RULES: IntentRule[] = [
	{
		name: "sequence",
		keywords: [
			"gene",
			"sequence",
			"dna",
			"rna",
			"genome",
			"chromosome",
			"mutation",
			"variant",
			"allele",
			"genotype",
			"exon",
			"intron",
			"promoter",
			"enhancer",
			"locus",
			"nucleotide",
			"coding",
			"transcript",
			"genomic",
			"cdna",
			"mrna",
			"trna",
			"rrna",
			"snps",
			"indel",
			"copy number",
			"expression",
			"regulation",
		],
		symbolBonus: true,
	},
	{
		name: "structure",
		keywords: [
			"protein",
			"structure",
			"domain",
			"amino acid",
			"enzyme",
			"pathway",
			"receptor",
			"ligand",
			"binding",
			"catalytic",
			"active site",
			"conformation",
			"folding",
			"motif",
			"subunit",
			"peptide",
			"polypeptide",
			"protease",
			"kinase",
			"phosphatase",
			"ubiquitin",
			"proteasome",
			"chaperone",
			"transmembrane",
			"helix",
			"sheet",
			"disulfide",
			"post-translational",
		],
		symbolBonus: true,
	},
	{
		name: "literature",
		keywords: [
			"paper",
			"literature",
			"publication",
			"study",
			"research",
			"article",
			"review",
			"pubmed",
			"journal",
			"doi",
			"citation",
			"reference",
			"bibliography",
			"manuscript",
			"preprint",
			"clinical trial",
			"meta-analysis",
			"systematic review",
			"evidence",
			"findings",
			"reported",
			"published",
		],
		symbolBonus: false,
	},
	{
		name: "disease",
		keywords: [
			"disease",
			"cancer",
			"disorder",
			"syndrome",
			"clinvar",
			"omim",
			"patient",
			"pathogenic",
			"phenotype",
			"symptom",
			"diagnosis",
			"prognosis",
			"therapy",
			"treatment",
			"drug",
			"pharmacogenomics",
			"biomarker",
			"oncogene",
			"tumor",
			"suppressor",
			"metastasis",
			"carcinoma",
			"sarcoma",
			"leukemia",
			"lymphoma",
			"melanoma",
			"neurodegenerative",
			"cardiovascular",
			"autoimmune",
			"inflammatory",
		],
		symbolBonus: true,
	},
];

// ── KeywordPlanner ─────────────────────────────────────────────────────────

/** Keyword-based planner with gene symbol detection. Serves as the fallback strategy. */
export class KeywordPlanner implements Planner {
	async plan(query: string, registry: BioToolRegistry): Promise<Plan> {
		const lower = query.toLowerCase();
		const subProblems: SubProblem[] = [];
		let idCounter = 0;

		// Detect gene/protein symbols in the query
		const detectedSymbols = this.extractSymbols(query);

		// Score each intent category
		const scoredIntents = INTENT_RULES.map((rule) => {
			let score = 0;
			for (const kw of rule.keywords) {
				if (lower.includes(kw)) score += 3;
			}
			// Boost score if the query contains a gene symbol match
			if (rule.symbolBonus && detectedSymbols.length > 0) {
				score += 2;
			}
			return { category: rule.name, score };
		});

		// Filter to matched intents (score >= 3)
		const matched = scoredIntents.filter((s) => s.score >= 3);

		if (matched.length > 0) {
			// Sort by score descending
			matched.sort((a, b) => b.score - a.score);

			for (const intent of matched) {
				subProblems.push({
					id: `sp-${++idCounter}`,
					goal: this.buildGoal(intent.category, query, detectedSymbols),
					toolCategories: [intent.category],
					dependsOn: [],
				});
			}
		}

		// Fallback: no intent detected — use registry suggestions
		if (subProblems.length === 0) {
			const suggested = registry.suggest(query);
			const categories = [...new Set(suggested.map((t) => t.category))];
			subProblems.push({
				id: `sp-${++idCounter}`,
				goal: `Research: ${query}`,
				toolCategories: categories.length > 0 ? categories : ["sequence", "structure", "literature"],
				dependsOn: [],
			});
		}

		const intentNames = subProblems.map((sp) => sp.toolCategories.join(", "));
		return {
			subProblems,
			reasoning: `Decomposed into ${subProblems.length} parallel sub-problem(s) based on intents: ${intentNames.join("; ")}.${detectedSymbols.length > 0 ? ` Identified symbols: ${detectedSymbols.join(", ")}.` : ""}`,
		};
	}

	/** Extract likely gene/protein symbols from the query. */
	private extractSymbols(query: string): string[] {
		const matches = query.match(GENE_SYMBOL_RE);
		if (!matches) return [];
		return [...new Set(matches.map((m) => m.toUpperCase()))].filter((sym) => !FALSE_POSITIVES.has(sym));
	}

	/** Build a goal string for the given intent category. */
	private buildGoal(category: ToolCategory, query: string, symbols: string[]): string {
		const symStr = symbols.length > 0 ? symbols.join(", ") : query;
		switch (category) {
			case "sequence":
				return `Find genes and sequence information related to: ${symStr}`;
			case "structure":
				return `Retrieve protein information and structural details for: ${symStr}`;
			case "literature":
				return `Search biomedical literature for evidence related to: ${symStr}`;
			case "disease":
				return `Find disease associations and clinical information for: ${symStr}`;
			default:
				return `Research: ${query}`;
		}
	}
}

/** @deprecated Use {@link KeywordPlanner} instead. */
export { KeywordPlanner as DefaultPlanner };

// ── LLMPlanner ─────────────────────────────────────────────────────────────

/** LLM-driven planner that uses a sub-agent to intelligently decompose queries. */
export class LLMPlanner implements Planner {
	private readonly fallback: Planner;

	/**
	 * @param agent - Parent BioAgent used to create reasoning sub-agents.
	 * @param fallback - Fallback planner used when LLM parsing fails (defaults to KeywordPlanner).
	 */
	constructor(
		private readonly agent: BioAgent,
		fallback?: Planner,
	) {
		this.fallback = fallback ?? new KeywordPlanner();
	}

	async plan(query: string, registry: BioToolRegistry): Promise<Plan> {
		try {
			return await this.llmPlan(query, registry);
		} catch {
			// On any error (LLM failure, JSON parse failure), fall back
			return this.fallback.plan(query, registry);
		}
	}

	/** Ask the LLM to decompose the query into a Plan. */
	private async llmPlan(query: string, registry: BioToolRegistry): Promise<Plan> {
		const prompt = this.buildPlanningPrompt(query, registry);

		// Create a sub-agent with no tools — it only needs reasoning
		const subAgent = this.agent.createSubAgent("planner", []);

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
		return this.parsePlanJson(rawText, query);
	}

	/** Build the planning prompt with available tool categories and output format. */
	private buildPlanningPrompt(query: string, registry: BioToolRegistry): string {
		const tools = registry.getAll();
		const categories = [...new Set(tools.map((t) => t.category))];

		const categoryDescriptions = categories
			.map((cat) => {
				const catTools = tools.filter((t) => t.category === cat);
				const toolList = catTools.map((t) => `    - ${t.name}: ${t.description}`).join("\n");
				return `  - **${cat}**:\n${toolList || "    - (no tools registered)"}`;
			})
			.join("\n");

		return `You are a bioinformatics query planner. Decompose the user's query into independent sub-problems that can be solved in parallel.

Available tool categories:
${categoryDescriptions}

User query: ${query}

Output a JSON object with this exact structure:
{
  "subProblems": [
    {
      "id": "sp-1",
      "goal": "description of what to find",
      "toolCategories": ["category_name"],
      "dependsOn": []
    }
  ],
  "reasoning": "explanation of the decomposition strategy"
}

Rules:
1. Each sub-problem should target exactly one tool category
2. Keep sub-problems independent (parallel) unless they truly depend on each other
3. Only use categories that are relevant to the query
4. Create at least 1 sub-problem, at most 5
5. Use exact category names from the available categories list

Respond with ONLY the JSON object, no other text.`;
	}

	/** Parse LLM JSON output into a Plan. Throws on invalid output to trigger fallback. */
	private parsePlanJson(raw: string, query: string): Plan {
		// Strip markdown code blocks if present
		let json = raw;
		const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
		if (codeBlockMatch) {
			json = codeBlockMatch[1];
		}

		const parsed = JSON.parse(json) as Record<string, unknown>;

		if (!Array.isArray(parsed.subProblems)) {
			throw new Error("LLM response missing subProblems array");
		}

		const subProblems: SubProblem[] = (parsed.subProblems as unknown[]).map((sp: unknown, idx: number) => {
			const obj = sp as Record<string, unknown>;
			return {
				id: typeof obj.id === "string" ? obj.id : `sp-${idx + 1}`,
				goal: typeof obj.goal === "string" ? obj.goal : query,
				toolCategories: Array.isArray(obj.toolCategories)
					? obj.toolCategories.filter(
							(c): c is ToolCategory => typeof c === "string" && VALID_CATEGORIES.includes(c as ToolCategory),
						)
					: [],
				dependsOn: Array.isArray(obj.dependsOn)
					? obj.dependsOn.filter((d): d is string => typeof d === "string")
					: [],
			};
		});

		return {
			subProblems,
			reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : `LLM decomposition of: ${query}`,
		};
	}
}
