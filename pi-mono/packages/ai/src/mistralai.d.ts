// Type declarations for @mistralai/mistralai — package ships JS without .d.ts entry points
// Generated from packages/ai/src/providers/mistral.ts usage analysis

declare module "@mistralai/mistralai" {
	export class Mistral {
		constructor(options: { apiKey: string; serverURL?: string });
		chat: {
			complete(request: unknown, options?: unknown): Promise<unknown>;
			stream(
				request: unknown,
				options?: unknown,
			): AsyncIterable<{
				data: {
					id?: string;
					usage?: {
						promptTokens: number;
						completionTokens: number;
						totalTokens: number;
					};
					choices: Array<{
						delta: {
							content?:
								| string
								| Array<{
										type: "text";
										text: string;
								  }>;
							toolCalls?: Array<{
								id?: string;
								index?: number;
								type: "function";
								function: {
									name: string;
									arguments: string;
								};
							}>;
							role?: string;
						};
						finishReason?: string;
					}>;
				};
			}>;
		};
	}
}

declare module "@mistralai/mistralai/models/components" {
	export interface ChatCompletionStreamRequest {
		model: string;
		messages: ChatCompletionStreamRequestMessage[];
		stream: boolean;
		tools?: Array<{
			type: "function";
			function: {
				name: string;
				description?: string;
				parameters: Record<string, unknown>;
				strict?: boolean;
			};
		}>;
		toolChoice?: "auto" | "none" | "any" | "required" | { type: "function"; function: { name: string } };
		temperature?: number;
		maxTokens?: number;
		promptMode?: "reasoning";
		reasoningEffort?: "none" | "high";
	}

	export interface ChatCompletionStreamRequestMessage {
		role: "system" | "user" | "assistant" | "tool";
		content?:
			| string
			| Array<
					| { type: "text"; text: string }
					| { type: "thinking"; thinking: Array<{ type: "text"; text: string }> }
					| { type: "image_url"; imageUrl: string }
					| { type: "text"; text: string }
			  >;
		toolCalls?: Array<{
			id: string;
			type: "function";
			function: {
				name: string;
				arguments: string;
			};
		}>;
		toolCallId?: string;
		name?: string;
	}

	export interface CompletionEvent {
		data: {
			id?: string;
			usage?: {
				promptTokens: number;
				completionTokens: number;
				totalTokens: number;
			};
			choices: Array<{
				delta: {
					content?: string | ContentChunk[];
					toolCalls?: ToolCall[];
					role?: string;
				};
				finishReason?: string;
			}>;
		};
	}

	export type ContentChunk =
		| { type: "text"; text: string }
		| { type: "thinking"; thinking: Array<{ type: "text"; text: string }> }
		| { type: "image_url"; imageUrl: string };

	export interface FunctionTool {
		type: "function";
		function: {
			name: string;
			description?: string;
			parameters: Record<string, unknown>;
			strict?: boolean;
		};
	}

	export interface ToolCall {
		id?: string;
		index?: number;
		type: "function";
		function: {
			name: string;
			arguments: string;
		};
	}
}
