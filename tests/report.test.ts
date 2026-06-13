import assert from "node:assert/strict";
import test from "node:test";

import { buildReportModel } from "../src/report-model.ts";
import { renderMarkdownReport } from "../src/markdown-render.ts";

const sessionA = {
	file: "/tmp/session-a.jsonl",
	header: { type: "session", id: "s1", cwd: "/repo/pi-daily" },
	entries: [
		{ type: "message", timestamp: "2026-06-12T09:00:00.000Z", message: { role: "user", content: "实现日报 MVP" } },
		{
			type: "message",
			timestamp: "2026-06-12T09:01:00.000Z",
			message: {
				role: "assistant",
				content: [
					{ type: "text", text: "已完成 session 扫描器基础实现" },
					{ type: "toolCall", id: "t1", name: "read", arguments: { path: "src/README.md" } },
				],
			},
		},
		{
			type: "message",
			timestamp: "2026-06-12T09:02:00.000Z",
			message: { role: "toolResult", toolName: "read", content: [{ type: "text", text: "# src" }], isError: false },
		},
		{ type: "message", timestamp: "2026-06-11T09:00:00.000Z", message: { role: "user", content: "昨天" } },
	],
};

const sessionB = {
	file: "/tmp/session-b.jsonl",
	header: { type: "session", id: "s2", cwd: "/repo/ai-database-vault" },
	entries: [
		{ type: "message", timestamp: "2026-06-12T10:00:00.000Z", message: { role: "user", content: "整理 vault 文档" } },
		{ type: "message", timestamp: "2026-06-12T10:01:00.000Z", message: { role: "assistant", content: "已完成 vault 目录结构梳理" } },
	],
};

test("buildReportModel aggregates target date activity", () => {
	const report = buildReportModel({ date: "2026-06-12", sessions: [sessionA, sessionB] });
	assert.equal(report.stats.sessionCount, 2);
	assert.equal(report.stats.projectCount, 2);
	assert.equal(report.projects.length, 2);
	assert.equal(report.projects[0].projectName, "pi-daily");
	assert.equal(report.projects[0].isDefaultWorkspace, false);
	assert.equal(report.projects[1].projectName, "ai-database-vault");
	assert.equal(report.tasks[0].text, "实现日报 MVP");
	assert.equal(report.completed[0].text, "已完成 session 扫描器基础实现");
	assert.equal(report.followUps.length, 0);
	assert.equal(report.files.includes("src/README.md"), true);
	assert.equal(report.projects[1].completed[0].text, "已完成 vault 目录结构梳理");
});

test("renderMarkdownReport renders expected sections", () => {
	const report = buildReportModel({ date: "2026-06-12", sessions: [sessionA, sessionB] });
	const markdown = renderMarkdownReport(report);
	assert.match(markdown, /^# 2026-06-12 工作日报/);
	assert.match(markdown, /## 今日概览/);
	assert.match(markdown, /## 完成事项/);
	assert.match(markdown, /已完成 session 扫描器基础实现/);
});
