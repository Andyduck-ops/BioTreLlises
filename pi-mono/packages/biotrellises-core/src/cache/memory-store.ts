/**
 * In-memory cache store implementation for BioTreLlises.
 *
 * Entries are stored in a Map and evicted by TTL expiry on read.
 * Periodic cleanup is optional; expired entries are filtered lazily.
 */

import type { CacheEntry, CacheOptions, CacheStore } from "./store.js";

/** In-memory cache store with TTL support. */
export class MemoryCacheStore implements CacheStore {
	private store = new Map<string, CacheEntry<unknown>>();

	async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
		const entry = this.store.get(key) as CacheEntry<T> | undefined;
		if (!entry) return undefined;
		if (entry.expiresAt && entry.expiresAt <= Date.now()) {
			this.store.delete(key);
			return undefined;
		}
		return entry;
	}

	async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
		const ttl = options?.ttl;
		const expiresAt = ttl !== undefined && ttl >= 0 ? Date.now() + ttl * 1000 : undefined;
		this.store.set(key, { value, expiresAt });
	}

	async delete(key: string): Promise<void> {
		this.store.delete(key);
	}

	async clear(): Promise<void> {
		this.store.clear();
	}

	/** Number of entries currently in the cache (including expired but not yet evicted). */
	get size(): number {
		return this.store.size;
	}
}
