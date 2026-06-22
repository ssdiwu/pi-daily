import assert from "node:assert/strict";
import test from "node:test";

import { parseDailyArgs } from "../src/args.ts";
import { parseNaturalDailyArgs } from "../src/natural-time.ts";

test("parseNaturalDailyArgs understands overnight work", () => {
	const result = parseNaturalDailyArgs("昨晚到今天凌晨", new Date("2026-06-13T09:00:00"));
	assert.ok(result);
	assert.equal(result.date, "2026-06-12");
	assert.match(result.window.label, /2026-06-12 18:00 → 2026-06-13 05:00/);
});

test("parseDailyArgs uses natural language when no advanced flags are present", () => {
	const options = parseDailyArgs("昨晚加班 --save", new Date("2026-06-13T09:00:00"));
	assert.equal(options.date, "2026-06-12");
	assert.equal(options.save, true);
	assert.match(options.window.label, /2026-06-12 18:00 → 2026-06-13 05:00/);
	assert.match(options.confirmation?.message || "", /2026-06-12 18:00 → 2026-06-13 05:00/);
});

test("parseDailyArgs understands recent hours", () => {
	const options = parseDailyArgs("最近 8 小时", new Date("2026-06-13T02:30:00"));
	assert.equal(options.date, "2026-06-12");
	assert.match(options.window.label, /2026-06-12 18:30 → 2026-06-13 02:30/);
});

test("parseDailyArgs keeps explicit flags authoritative", () => {
	const options = parseDailyArgs("昨晚 --since 20:00 --until 02:00", new Date("2026-06-13T09:00:00"));
	assert.equal(options.date, "2026-06-13");
	assert.match(options.window.label, /2026-06-13 20:00 → 2026-06-14 02:00/);
});

test("parseNaturalDailyArgs understands explicit clock ranges", () => {
	const result = parseNaturalDailyArgs("昨天晚上 8 点到凌晨 2 点", new Date("2026-06-13T09:00:00"));
	assert.ok(result);
	assert.equal(result.date, "2026-06-12");
	assert.match(result.window.label, /2026-06-12 20:00 → 2026-06-13 02:00/);
});

test("parseNaturalDailyArgs understands workday boundary", () => {
	const result = parseNaturalDailyArgs("按工作日从 5 点开始", new Date("2026-06-13T01:30:00"));
	assert.ok(result);
	assert.equal(result.date, "2026-06-12");
	assert.match(result.window.label, /2026-06-12 05:00 → 2026-06-13 05:00/);
});

test("parseNaturalDailyArgs understands absolute date range with clocks", () => {
	const result = parseNaturalDailyArgs("6月21号凌晨5点到6月22号凌晨5点", new Date("2026-06-22T10:00:00"));
	assert.ok(result);
	assert.equal(result.date, "2026-06-21");
	assert.match(result.window.label, /2026-06-21 05:00 → 2026-06-22 05:00/);
});

test("parseNaturalDailyArgs handles absolute date range inside a sentence", () => {
	const result = parseNaturalDailyArgs("帮我跑6月21号凌晨5点到6月22号凌晨5点的日报出来", new Date("2026-06-22T10:00:00"));
	assert.ok(result);
	assert.equal(result.date, "2026-06-21");
	assert.match(result.window.label, /2026-06-21 05:00 → 2026-06-22 05:00/);
});
