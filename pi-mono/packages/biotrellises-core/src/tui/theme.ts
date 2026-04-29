/**
 * BioTreLlises TUI theme — lightweight color scheme using ANSI colors.
 */

import type { EditorTheme, MarkdownTheme, SelectListTheme } from "@mariozechner/pi-tui";

// Simple color functions using ANSI escape codes
const green = (text: string) => `\x1b[32m${text}\x1b[39m`;
const cyan = (text: string) => `\x1b[36m${text}\x1b[39m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[39m`;
const blue = (text: string) => `\x1b[34m${text}\x1b[39m`;
const bold = (text: string) => `\x1b[1m${text}\x1b[22m`;
const italic = (text: string) => `\x1b[3m${text}\x1b[23m`;
const underline = (text: string) => `\x1b[4m${text}\x1b[24m`;
const gray = (text: string) => `\x1b[90m${text}\x1b[39m`;

/** Default select list theme for BioTreLlises. */
export function getBioSelectListTheme(): SelectListTheme {
	return {
		selectedPrefix: cyan,
		selectedText: cyan,
		description: gray,
		scrollInfo: gray,
		noMatch: gray,
	};
}

/** Default editor theme for BioTreLlises. */
export function getBioEditorTheme(): EditorTheme {
	return {
		borderColor: gray,
		selectList: getBioSelectListTheme(),
	};
}

/** Default markdown theme for BioTreLlises. */
export function getBioMarkdownTheme(): MarkdownTheme {
	return {
		heading: green,
		link: cyan,
		linkUrl: blue,
		code: yellow,
		codeBlock: yellow,
		codeBlockBorder: gray,
		quote: gray,
		quoteBorder: gray,
		hr: gray,
		listBullet: cyan,
		bold,
		italic,
		underline,
		strikethrough: (text: string) => `\x1b[9m${text}\x1b[29m`,
	};
}
