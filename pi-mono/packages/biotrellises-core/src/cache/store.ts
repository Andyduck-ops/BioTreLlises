/**
 * Cache storage abstraction for BioTreLlises.
 */

/** A single cache entry with an optional expiration timestamp. */
export interface CacheEntry<T> {
	/** Stored value. */
	value: T;
	/** Unix timestamp (ms) when the entry expires, or undefined if it never expires. */
	expiresAt?: number;
}

/** Options for cache write operations. */
export interface CacheOptions {
	/** Time-to-live in seconds. */
	ttl?: number;
}

/** Generic cache store interface. */
export interface CacheStore {
	/**
	 * Retrieve a value from the cache.
	 * @param key - Cache key.
	 * @returns The cached entry, or undefined if missing or expired.
	 */
	get<T>(key: string): Promise<CacheEntry<T> | undefined>;

	/**
	 * Store a value in the cache.
	 * @param key - Cache key.
	 * @param value - Value to cache.
	 * @param options - Optional TTL or other settings.
	 */
	set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;

	/**
	 * Remove a single entry from the cache.
	 * @param key - Cache key.
	 */
	delete(key: string): Promise<void>;

	/** Clear all entries from the cache. */
	clear(): Promise<void>;
}
