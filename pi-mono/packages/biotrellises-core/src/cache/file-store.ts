/**
 * JSONL file-backed persistent cache store for BioTreLlises.
 *
 * Cache file location: ~/.biotrellises/cache.jsonl
 * Format: one JSON object per line: {"key":"...","value":...,"expiresAt":...}
 *
 * On startup, the file is read entirely into memory. Writes append
 * new lines without compacting. On reload, duplicate keys resolve
 * to the last-written entry.
 */

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { CacheEntry, CacheOptions, CacheStore } from "./store.js";

/** Cached entry serialised as JSONL line. */
interface JsonLine {
	key: string;
	value: unknown;
	expiresAt?: number;
}

export class FileCacheStore implements CacheStore {
	private memory = new Map<string, CacheEntry<unknown>>();
	private readonly filePath: string;

	constructor(filePath?: string) {
		this.filePath = filePath ?? join(homedir(), ".biotrellises", "cache.jsonl");
		this.loadFromFile();
	}

	get<T>(key: string): Promise<CacheEntry<T> | undefined> {
		const entry = this.memory.get(key) as CacheEntry<T> | undefined;
		if (!entry) return Promise.resolve(undefined);
		if (entry.expiresAt && entry.expiresAt <= Date.now()) {
			this.memory.delete(key);
			return Promise.resolve(undefined);
		}
		return Promise.resolve(entry);
	}

	async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
		const ttl = options?.ttl;
		const expiresAt = ttl !== undefined && ttl >= 0 ? Date.now() + ttl * 1000 : undefined;
		this.memory.set(key, { value, expiresAt } as CacheEntry<unknown>);
		this.appendToFile(key, { value, expiresAt });
	}

	async delete(key: string): Promise<void> {
		this.memory.delete(key);
	}

	async clear(): Promise<void> {
		this.memory.clear();
		writeFileSync(this.filePath, "", "utf-8");
	}

	get size(): number {
		return this.memory.size;
	}

	private loadFromFile(): void {
		try {
			const raw = readFileSync(this.filePath, "utf-8");
			const lines = raw.split("\n");
			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) continue;
				try {
					const entry = JSON.parse(trimmed) as JsonLine;
					if (!entry.key) continue;
					if (entry.expiresAt && entry.expiresAt <= Date.now()) continue;
					this.memory.set(entry.key, { value: entry.value, expiresAt: entry.expiresAt });
				} catch {
					// Skip corrupt lines
				}
			}
		} catch {
			// File doesn't exist yet — start with empty cache
		}
	}

	private appendToFile(key: string, entry: CacheEntry<unknown>): void {
		const dir = dirname(this.filePath);
		mkdirSync(dir, { recursive: true });
		const line: JsonLine = { key, value: entry.value, expiresAt: entry.expiresAt };
		appendFileSync(this.filePath, `${JSON.stringify(line)}\n`, "utf-8");
	}
}
