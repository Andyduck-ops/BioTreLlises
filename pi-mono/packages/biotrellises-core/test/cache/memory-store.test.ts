/**
 * Unit tests for MemoryCacheStore.
 */

import { describe, expect, it } from "vitest";
import { MemoryCacheStore } from "../../src/cache/memory-store.js";

describe("MemoryCacheStore", () => {
	it("should store and retrieve values", async () => {
		const cache = new MemoryCacheStore();
		await cache.set("key1", { data: "hello" });
		const entry = await cache.get<{ data: string }>("key1");
		expect(entry?.value.data).toBe("hello");
	});

	it("should return undefined for missing key", async () => {
		const cache = new MemoryCacheStore();
		const entry = await cache.get("nonexistent");
		expect(entry).toBeUndefined();
	});

	it("should expire entries based on TTL", async () => {
		const cache = new MemoryCacheStore();
		await cache.set("key1", "value", { ttl: 0 }); // 0 second TTL
		// Wait a tick for the TTL to expire
		await new Promise((resolve) => setTimeout(resolve, 10));
		const entry = await cache.get<string>("key1");
		expect(entry).toBeUndefined();
	});

	it("should delete entries", async () => {
		const cache = new MemoryCacheStore();
		await cache.set("key1", "value");
		await cache.delete("key1");
		const entry = await cache.get("key1");
		expect(entry).toBeUndefined();
	});

	it("should clear all entries", async () => {
		const cache = new MemoryCacheStore();
		await cache.set("a", 1);
		await cache.set("b", 2);
		await cache.clear();
		expect(await cache.get("a")).toBeUndefined();
		expect(await cache.get("b")).toBeUndefined();
	});

	it("should track entry count", async () => {
		const cache = new MemoryCacheStore();
		expect(cache.size).toBe(0);
		await cache.set("a", 1);
		expect(cache.size).toBe(1);
		await cache.set("b", 2);
		expect(cache.size).toBe(2);
		await cache.clear();
		expect(cache.size).toBe(0);
	});
});
