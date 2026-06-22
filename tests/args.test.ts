import assert from "node:assert/strict";
import test from "node:test";

import { parseDailyArgs, parseDailyArgsAsync } from "../src/args.ts";

test("parseDailyArgs defaults to today's local date", () => {
	const options = parseDailyArgs("", new Date("2026-06-12T10:00:00"));
	assert.equal(options.date, "2026-06-12");
	assert.equal(options.save, false);
	assert.equal(options.project, "all");
	assert.match(options.window.label, /2026-06-12 00:00 → 2026-06-13 00:00/);
});

test("parseDailyArgs accepts explicit date and flags", () => {
	const options = parseDailyArgs("2026-06-11 --save --project current", new Date("2026-06-12T10:00:00"));
	assert.equal(options.date, "2026-06-11");
	assert.equal(options.save, true);
	assert.equal(options.project, "current");
});

test("parseDailyArgs uses previous workday before day-start", () => {
	const options = parseDailyArgs("--day-start 05:00", new Date("2026-06-13T01:30:00"));
	assert.equal(options.date, "2026-06-12");
	assert.equal(options.window.dayStart, "05:00");
	assert.match(options.window.label, /2026-06-12 05:00 → 2026-06-13 05:00/);
});

test("parseDailyArgs supports day-start for work crossing midnight", () => {
	const options = parseDailyArgs("2026-06-12 --day-start 05:00", new Date("2026-06-12T10:00:00"));
	assert.equal(options.date, "2026-06-12");
	assert.equal(options.window.dayStart, "05:00");
	assert.match(options.window.label, /2026-06-12 05:00 → 2026-06-13 05:00/);
});

test("parseDailyArgs supports since and until crossing midnight", () => {
	const options = parseDailyArgs("2026-06-12 --since 18:00 --until 02:00", new Date("2026-06-12T10:00:00"));
	assert.match(options.window.label, /2026-06-12 18:00 → 2026-06-13 02:00/);
});

test("parseDailyArgs supports absolute from and to", () => {
	const options = parseDailyArgs("--from 2026-06-12T20:00 --to 2026-06-13T03:00", new Date("2026-06-12T10:00:00"));
	assert.equal(options.date, "2026-06-12");
	assert.match(options.window.label, /2026-06-12 20:00 → 2026-06-13 03:00/);
});

test("parseDailyArgs auto-traces previous workday when run in early morning", () => {
	// 凌晨 02:30 跑默认 /daily，应自动归到“昨天 05:00 → 今天 05:00”
	const options = parseDailyArgs("", new Date("2026-06-17T02:30:00"));
	assert.equal(options.date, "2026-06-16");
	assert.match(options.window.label, /2026-06-16 05:00 → 2026-06-17 05:00/);
	assert.match(options.window.label, /工作日从 05:00 开始/);
});

test("parseDailyArgs keeps today as default outside early morning", () => {
	// 早上 08:00 跑默认 /daily，仍是今天自然日
	const options = parseDailyArgs("", new Date("2026-06-17T08:00:00"));
	assert.equal(options.date, "2026-06-17");
	assert.match(options.window.label, /2026-06-17 00:00 → 2026-06-18 00:00/);
});

test("parseDailyArgsAsync falls back to regex when LLM throws", async () => {
	// ctx 有 model 但鉴权报错 → LLM 路径报错 → 回退正则，仍产生 confirmation。
	const ctx = {
		model: { provider: "x", id: "y" },
		modelRegistry: {
			getApiKeyAndHeaders: async () => {
				throw new Error("offline");
			},
		},
	};
	const options = await parseDailyArgsAsync("昨晚到今天凌晨", new Date("2026-06-13T09:00:00"), ctx);
	assert.equal(options.date, "2026-06-12");
	assert.match(options.window.label, /2026-06-12 18:00 → 2026-06-13 05:00/);
	assert.ok(options.confirmation, "fallback must still carry a confirmation");
	assert.match(options.confirmation!.message, /2026-06-12 18:00 → 2026-06-13 05:00/);
});

test("parseDailyArgsAsync respects advanced flags without calling LLM", async () => {
	// advanced flag 路径不应触发 LLM（即使 ctx 会报错，也能拿到正确 options）
	const ctx = {
		model: { provider: "x", id: "y" },
		modelRegistry: {
			getApiKeyAndHeaders: async () => {
				throw new Error("should not be called");
			},
		},
	};
	const options = await parseDailyArgsAsync("2026-06-12 --day-start 05:00", new Date("2026-06-12T10:00:00"), ctx);
	assert.equal(options.date, "2026-06-12");
	assert.match(options.window.label, /2026-06-12 05:00 → 2026-06-13 05:00/);
});

test("parseDailyArgsAsync without ctx behaves like sync parseDailyArgs", async () => {
	const options = await parseDailyArgsAsync("最近 8 小时", new Date("2026-06-13T02:30:00"));
	assert.equal(options.date, "2026-06-12");
	assert.match(options.window.label, /2026-06-12 18:30 → 2026-06-13 02:30/);
});
