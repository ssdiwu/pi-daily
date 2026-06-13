import assert from "node:assert/strict";
import test from "node:test";

import { redactText, truncateText } from "../src/redact.ts";

test("redactText redacts common secrets", () => {
	const text = redactText("OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz123456 Bearer abc.def.ghi");
	assert.equal(text.includes("sk-abcdefghijklmnopqrstuvwxyz123456"), false);
	assert.equal(text.includes("Bearer abc.def.ghi"), false);
	assert.equal(text.includes("[REDACTED]"), true);
});

test("truncateText keeps short summaries", () => {
	assert.equal(truncateText("hello world", 20), "hello world");
	assert.equal(truncateText("a".repeat(30), 10), "aaaaaaaaa…");
});
