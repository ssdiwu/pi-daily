import assert from "node:assert/strict";
import test from "node:test";

import { buildReportModel } from "../src/report-model.ts";
import { createDefaultWindow } from "../src/session-extract.ts";
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

const overnightSession = {
	file: "/tmp/session-c.jsonl",
	header: { type: "session", id: "s3", cwd: "/repo/pi-daily" },
	entries: [
		{ type: "message", timestamp: "2026-06-12T23:50:00", message: { role: "user", content: "继续修复日报时间窗口" } },
		{ type: "message", timestamp: "2026-06-13T00:20:00", message: { role: "assistant", content: "已完成时间窗口支持" } },
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
	assert.equal(report.window.label, createDefaultWindow("2026-06-12").label);
});

test("buildReportModel can include overnight work in a custom window", () => {
	const report = buildReportModel({
		date: "2026-06-12",
		window: { start: new Date("2026-06-12T18:00:00"), end: new Date("2026-06-13T02:00:00"), label: "2026-06-12 18:00 → 2026-06-13 02:00" },
		sessions: [overnightSession],
		now: new Date("2026-06-13T09:15:30"),
	});
	assert.equal(report.stats.sessionCount, 1);
	assert.equal(report.tasks[0].text, "继续修复日报时间窗口");
	assert.equal(report.completed[0].text, "已完成时间窗口支持");
	assert.equal(report.window.label, "2026-06-12 18:00 → 2026-06-13 02:00");
	assert.equal(report.generatedAt, "2026-06-13 09:15:30");
});

test("renderMarkdownReport renders expected sections in zh-CN", () => {
	const report = buildReportModel({ date: "2026-06-12", sessions: [sessionA, sessionB] });
	const markdown = renderMarkdownReport(report, "zh-CN");
	assert.match(markdown, /^# 2026-06-12 工作日报/);
	assert.match(markdown, /统计范围：2026-06-12 00:00 → 2026-06-13 00:00/);
	assert.match(markdown, /## 今日概览/);
	assert.match(markdown, /## 完成事项/);
	assert.match(markdown, /已完成 session 扫描器基础实现/);
});

test("renderMarkdownReport switches to English for en-US locale", () => {
	const report = buildReportModel({ date: "2026-06-12", sessions: [sessionA, sessionB] });
	const markdown = renderMarkdownReport(report, "en-US");
	assert.match(markdown, /^# Work report for 2026-06-12/);
	assert.match(markdown, /## Overview/);
	assert.match(markdown, /## Completed/);
	assert.match(markdown, /Active projects: 2/);
	assert.match(markdown, /No records/);
});
