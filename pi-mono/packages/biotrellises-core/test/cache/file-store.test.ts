/**
 * Unit tests for FileCacheStore.
 */

import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileCacheStore } from "../../src/cache/file-store.js";

function tempPath(): string {
	return join(tmpdir(), `biotrellises-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
}

describe("FileCacheStore", () => {
	let store: FileCacheStore;
	let filePath: string;

	beforeEach(() => {
		filePath = tempPath();
		store = new FileCacheStore(filePath);
	});

	afterEach(() => {
		if (existsSync(filePath)) unlinkSync(filePath);
	});

	it("stores and retrieves a value", async () => {
		await store.set("key1", { data: "hello" });
		const entry = await store.get<{ data: string }>("key1");
		expect(entry).toBeDefined();
		expect(entry!.value.data).toBe("hello");
	});

	it("returns undefined for missing keys", async () => {
		const entry = await store.get("nonexistent");
		expect(entry).toBeUndefined();
	});

	it("evicts expired entries on get", async () => {
		await store.set("ephemeral", "data", { ttl: 0 });
		const entry = await store.get("ephemeral");
		expect(entry).toBeUndefined();
	});

	it("treats ttl 0 as valid immediate expiry", async () => {
		await store.set("instant", "gone", { ttl: 0 });
		expect(await store.get("instant")).toBeUndefined();
	});

	it("deletes entries", async () => {
		await store.set("temp", 42);
		await store.delete("temp");
		expect(await store.get("temp")).toBeUndefined();
	});

	it("clears all entries", async () => {
		await store.set("a", 1);
		await store.set("b", 2);
		await store.clear();
		expect(await store.get("a")).toBeUndefined();
		expect(await store.get("b")).toBeUndefined();
		expect(store.size).toBe(0);
	});

	it("survives restart via persistent file", async () => {
		await store.set("persist", { value: "survives" });

		const store2 = new FileCacheStore(filePath);
		const entry = await store2.get<{ value: string }>("persist");
		expect(entry).toBeDefined();
		expect(entry!.value.value).toBe("survives");
	});

	it("does not load expired entries from file", async () => {
		await store.set("stale", "old", { ttl: 0 });

		const store2 = new FileCacheStore(filePath);
		expect(await store2.get("stale")).toBeUndefined();
	});

	it("handles non-existent file gracefully", () => {
		const nonexistent = join(tmpdir(), `biotrellises-nonexistent-${Date.now()}.jsonl`);
		const s = new FileCacheStore(nonexistent);
		expect(s.size).toBe(0);
	});

	it("tracks size correctly", async () => {
		expect(store.size).toBe(0);
		await store.set("x", 1);
		expect(store.size).toBe(1);
		await store.set("y", 2);
		expect(store.size).toBe(2);
		await store.delete("x");
		expect(store.size).toBe(1);
	});
});
