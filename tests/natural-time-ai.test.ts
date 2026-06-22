import assert from "node:assert/strict";
import test from "node:test";

import { parseNaturalDailyArgsWithAI, shapeFromAIResult, __test__ } from "../src/natural-time-ai.ts";

test("shapeFromAIResult builds window from valid local datetimes", () => {
	const shape = shapeFromAIResult({ start: "2026-06-21T05:00", end: "2026-06-22T05:00", confidence: "high" });
	assert.ok(shape);
	assert.equal(shape!.date, "2026-06-21");
	assert.match(shape!.window.label, /2026-06-21 05:00 → 2026-06-22 05:00/);
});

test("shapeFromAIResult rejects end <= start", () => {
	assert.equal(shapeFromAIResult({ start: "2026-06-22T05:00", end: "2026-06-22T05:00" }), undefined);
	assert.equal(shapeFromAIResult({ start: "2026-06-22T06:00", end: "2026-06-22T05:00" }), undefined);
});

test("shapeFromAIResult rejects malformed strings", () => {
	assert.equal(shapeFromAIResult({ start: "not-a-date", end: "2026-06-22T05:00" }), undefined);
	assert.equal(shapeFromAIResult({ start: "", end: "" }), undefined);
});

test("parseLocalParts validates YYYY-MM-DDTHH:mm", () => {
	assert.ok(__test__.parseLocalParts("2026-06-21T05:00"));
	assert.equal(__test__.parseLocalParts("2026-6-21T5:00"), undefined);
	assert.equal(__test__.parseLocalParts(""), undefined);
});

test("extractJsonObject handles fenced and plain JSON", () => {
	assert.equal(__test__.extractJsonObject('```json\n{"a":1}\n```'), '{"a":1}');
	assert.equal(__test__.extractJsonObject('before {"a":1} after'), '{"a":1}');
	assert.equal(__test__.extractJsonObject("no json here"), undefined);
});

test("buildTimeParsePrompt injects now and asks for JSON only", () => {
	const now = new Date("2026-06-22T10:30:00");
	const prompt = __test__.buildTimeParsePrompt("6月21号凌晨5点到6月22号凌晨5点", now);
	assert.match(prompt, /2026-06-22T10:30/);
	assert.match(prompt, /只输出一个 JSON 对象/);
	assert.match(prompt, /6月21号凌晨5点到6月22号凌晨5点/);
});

test("parseNaturalDailyArgsWithAI returns undefined without ctx", async () => {
	const result = await parseNaturalDailyArgsWithAI("昨天", undefined as any);
	assert.equal(result, undefined);
});

test("parseNaturalDailyArgsWithAI returns undefined without modelRegistry", async () => {
	const result = await parseNaturalDailyArgsWithAI("昨天", { model: {} } as any);
	assert.equal(result, undefined);
});

test("parseNaturalDailyArgsWithAI falls back when model call throws", async () => {
	const ctx = {
		model: { provider: "x", id: "y" },
		modelRegistry: {
			getApiKeyAndHeaders: async () => {
				throw new Error("network down");
			},
		},
	};
	const result = await parseNaturalDailyArgsWithAI("昨天", ctx as any);
	assert.equal(result, undefined);
});
