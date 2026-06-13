import assert from "node:assert/strict";
import test from "node:test";

import { parseSessionJsonl } from "../src/session-scan.ts";

test("parseSessionJsonl tolerates bad lines", () => {
	const parsed = parseSessionJsonl([
		JSON.stringify({ type: "session", id: "s1", cwd: "/tmp/project" }),
		"{bad-json",
		JSON.stringify({ type: "message", message: { role: "user", content: "hello" } }),
	].join("\n"));

	assert.ok(parsed.header);
	assert.equal(parsed.header.id, "s1");
	assert.equal(parsed.entries.length, 2);
	assert.equal(parsed.errors?.length, 1);
	assert.equal(parsed.errors?.[0].line, 2);
});
