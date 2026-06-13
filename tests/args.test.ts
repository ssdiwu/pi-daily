import assert from "node:assert/strict";
import test from "node:test";

import { parseDailyArgs } from "../src/args.ts";

test("parseDailyArgs defaults to today's local date", () => {
	const options = parseDailyArgs("", new Date("2026-06-12T10:00:00"));
	assert.equal(options.date, "2026-06-12");
	assert.equal(options.save, false);
	assert.equal(options.project, "all");
});

test("parseDailyArgs accepts explicit date and flags", () => {
	const options = parseDailyArgs("2026-06-11 --save --project current", new Date("2026-06-12T10:00:00"));
	assert.deepEqual(options, {
		date: "2026-06-11",
		save: true,
		project: "current",
	});
});
