/**
 * Base connector implementation with rate limiting, retry, and caching.
 */

import type { CachePolicy } from "../cache/policy.js";
import type { CacheStore } from "../cache/store.js";
import { type BioConnector, ConnectorError, type RateLimit } from "./types.js";

/** Options for creating a BaseConnector. */
export interface BaseConnectorOptions {
	/** Human-readable connector name. */
	name: string;
	/** Base URL for all requests. */
	baseUrl: string;
	/** Rate-limit settings. */
	rateLimit: RateLimit;
	/** Optional cache store for request caching. */
	cache?: CacheStore;
	/** Optional cache policy for TTL rules. */
	cachePolicy?: CachePolicy;
	/** Optional custom headers sent with every request. */
	headers?: Record<string, string>;
}

/** Base connector with rate limiting, retry logic, and optional caching. */
export class BaseConnector implements BioConnector {
	readonly name: string;
	readonly baseUrl: string;
	readonly rateLimit: RateLimit;
	readonly cache?: CacheStore;
	readonly cachePolicy?: CachePolicy;
	readonly headers: Record<string, string>;

	private lastRequestTime = 0;

	constructor(options: BaseConnectorOptions) {
		this.name = options.name;
		this.baseUrl = options.baseUrl.replace(/\/$/, "");
		this.rateLimit = options.rateLimit;
		this.cache = options.cache;
		this.cachePolicy = options.cachePolicy;
		this.headers = options.headers ?? {};
	}

	/**
	 * Perform an HTTP GET request with rate limiting, retry, and caching.
	 */
	async request<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
		const url = this.buildUrl(endpoint, params);
		const cacheKey = url;

		// Try cache first
		if (this.cache) {
			const cached = await this.cache.get<T>(cacheKey);
			if (cached && (!cached.expiresAt || cached.expiresAt > Date.now())) {
				return cached.value;
			}
		}

		// Enforce rate limit
		await this.enforceRateLimit();

		// Execute with retry
		const response = await this.fetchWithRetry(url);

		if (!response.ok) {
			throw new ConnectorError(`HTTP ${response.status}: ${response.statusText}`, response.status, endpoint);
		}

		const data = (await response.json()) as T;

		// Store in cache
		if (this.cache) {
			const ttl = this.cachePolicy?.getTTL(endpoint) ?? 3600;
			await this.cache.set(cacheKey, data, { ttl });
		}

		return data;
	}

	/**
	 * Perform an HTTP GET request and return the raw text response.
	 * Used for endpoints that return non-JSON (e.g., NCBI efetch with XML).
	 */
	async requestText(endpoint: string, params?: Record<string, unknown>): Promise<string> {
		const url = this.buildUrl(endpoint, params);
		const cacheKey = `text:${url}`;

		// Try cache first
		if (this.cache) {
			const cached = await this.cache.get<string>(cacheKey);
			if (cached && (!cached.expiresAt || cached.expiresAt > Date.now())) {
				return cached.value;
			}
		}

		await this.enforceRateLimit();
		const response = await this.fetchWithRetry(url);

		if (!response.ok) {
			throw new ConnectorError(`HTTP ${response.status}: ${response.statusText}`, response.status, endpoint);
		}

		const text = await response.text();

		if (this.cache) {
			const ttl = this.cachePolicy?.getTTL(endpoint) ?? 3600;
			await this.cache.set(cacheKey, text, { ttl });
		}

		return text;
	}

	/** Build a full URL with query parameters. */
	private buildUrl(endpoint: string, params?: Record<string, unknown>): string {
		const base = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`;
		const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
		const url = new URL(cleanEndpoint, base);
		if (params) {
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined && value !== null) {
					url.searchParams.set(key, String(value));
				}
			}
		}
		return url.toString();
	}

	/** Enforce rate limiting by delaying if necessary. */
	private async enforceRateLimit(): Promise<void> {
		const minInterval = 1000 / this.rateLimit.requestsPerSecond;
		const now = Date.now();
		const elapsed = now - this.lastRequestTime;
		if (elapsed < minInterval) {
			await new Promise((resolve) => setTimeout(resolve, minInterval - elapsed));
		}
		this.lastRequestTime = Date.now();
	}

	/** Fetch with exponential backoff retry. */
	private async fetchWithRetry(url: string, attempt = 1): Promise<Response> {
		try {
			return await fetch(url, {
				headers: {
					Accept: "application/json",
					...this.headers,
				},
			});
		} catch (error) {
			if (attempt >= this.rateLimit.maxRetries) {
				throw new ConnectorError(
					`Network error after ${attempt} attempts: ${error instanceof Error ? error.message : String(error)}`,
					0,
					url,
				);
			}
			const delay = Math.min(1000 * 2 ** attempt, 30000);
			await new Promise((resolve) => setTimeout(resolve, delay));
			return this.fetchWithRetry(url, attempt + 1);
		}
	}
}
