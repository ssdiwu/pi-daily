import assert from "node:assert/strict";
import test from "node:test";

import { __test__ } from "../src/pi-ai-loader.ts";

test("loadPiAICompleteModuleWith prefers compat entry when available", async () => {
	const calls: string[] = [];
	const mod = await __test__.loadPiAICompleteModuleWith(
		(specifier) => `resolved:${specifier}`,
		async (specifier) => {
			calls.push(specifier);
			if (specifier === "resolved:@earendil-works/pi-ai/compat") {
				return { complete: async () => ({ ok: true }) };
			}
			throw new Error(`unexpected import ${specifier}`);
		},
	);
	assert.equal(typeof mod.complete, "function");
	assert.deepEqual(calls, ["resolved:@earendil-works/pi-ai/compat"]);
});

test("loadPiAICompleteModuleWith falls back to legacy stream.js", async () => {
	const calls: string[] = [];
	const mod = await __test__.loadPiAICompleteModuleWith(
		(specifier) => `file:///virtual/${specifier === "@earendil-works/pi-ai" ? "dist/index.js" : specifier}`,
		async (specifier) => {
			calls.push(specifier);
			if (specifier === "file:///virtual/dist/index.js") {
				throw new Error("root import should not happen directly");
			}
			if (specifier === "file:///virtual/@earendil-works/pi-ai/compat") {
				throw new Error("compat missing");
			}
			if (specifier === "file:///virtual/dist/stream.js") {
				return { complete: async () => ({ ok: true }) };
			}
			throw new Error(`unexpected import ${specifier}`);
		},
	);
	assert.equal(typeof mod.complete, "function");
	assert.deepEqual(calls, ["file:///virtual/@earendil-works/pi-ai/compat", "file:///virtual/dist/stream.js"]);
});

test("loadPiAICompleteModuleWith reports both attempts when all fail", async () => {
	await assert.rejects(
		() => __test__.loadPiAICompleteModuleWith(
			(specifier) => `resolved:${specifier}`,
			async (specifier) => {
				throw new Error(`boom ${specifier}`);
			},
		),
		(error: any) => {
			assert.match(String(error.message), /@earendil-works\/pi-ai\/compat/);
			assert.match(String(error.message), /legacy stream\.js/);
			return true;
		},
	);
});
