/**
 * Unit tests for BioTuiApp.
 */

import type { Agent } from "@mariozechner/pi-agent-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BioTuiApp } from "../../src/tui/app.js";

describe("BioTuiApp", () => {
	let mockAgent: Agent;

	beforeEach(() => {
		mockAgent = {
			prompt: vi.fn().mockResolvedValue(undefined),
			subscribe: vi.fn().mockReturnValue(() => {}),
			state: { systemPrompt: "test", tools: [], messages: [] },
		} as unknown as Agent;
	});

	it("should construct with agent", () => {
		const app = new BioTuiApp({ agent: mockAgent });
		expect(app).toBeDefined();
		expect(app.getStatus()).toBe("idle");
		expect(app.tui).toBeDefined();
		expect(app.editor).toBeDefined();
	});

	it("should set and get status", () => {
		const app = new BioTuiApp({ agent: mockAgent });
		app.setStatus("planning");
		expect(app.getStatus()).toBe("planning");
		app.setStatus("executing", "tool: test");
		expect(app.getStatus()).toBe("executing");
	});

	it("should append markdown to results", () => {
		const app = new BioTuiApp({ agent: mockAgent });
		app.appendMarkdown("# Hello\n\nWorld");
		// Component should be added to results container
		// biome-ignore lint/complexity/useLiteralKeys: accessing private field for test assertion
		expect(app["resultsContainer"].children.length).toBeGreaterThan(0);
	});

	it("should append text to results", () => {
		const app = new BioTuiApp({ agent: mockAgent });
		app.appendText("Hello world");
		// biome-ignore lint/complexity/useLiteralKeys: accessing private field for test assertion
		expect(app["resultsContainer"].children.length).toBeGreaterThan(0);
	});

	it("should clear results", () => {
		const app = new BioTuiApp({ agent: mockAgent });
		app.appendText("Hello");
		app.clearResults();
		// biome-ignore lint/complexity/useLiteralKeys: accessing private field for test assertion
		expect(app["resultsContainer"].children.length).toBe(0);
	});

	it("should add welcome message on construct", () => {
		const app = new BioTuiApp({
			agent: mockAgent,
			welcomeMessage: "# Welcome to BioTreLlises",
		});
		// biome-ignore lint/complexity/useLiteralKeys: accessing private field for test assertion
		expect(app["resultsContainer"].children.length).toBeGreaterThan(0);
	});

	it("should handle submit with empty text", async () => {
		const app = new BioTuiApp({ agent: mockAgent });
		// Simulate onSubmit with empty text (should be no-op)
		// biome-ignore lint/complexity/useLiteralKeys: accessing private method for test
		app["handleSubmit"]("");
		expect(mockAgent.prompt).not.toHaveBeenCalled();
	});
});
