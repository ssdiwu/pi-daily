import assert from "node:assert/strict";
import test from "node:test";

import { buildSummaryFacts, buildSummaryPrompt } from "../src/ai-summary.ts";

const report = {
	date: "2026-06-12",
	generatedAt: "2026-06-12T00:00:00.000Z",
	projectFilter: "all",
	currentCwd: "",
	stats: { projectCount: 2, sessionCount: 3, entryCount: 20, fileCount: 4, scanErrorCount: 0 },
	projects: [
		{
			projectName: "pi-daily",
			cwd: "/repo/pi-daily",
			isDefaultWorkspace: false,
			sessionCount: 1,
			entryCount: 10,
			files: [],
			tasks: [],
			completed: [],
			outputs: [],
			risks: [],
			followUps: [],
			toolCounts: [],
		},
		{
			projectName: "ai-database-vault",
			cwd: "/repo/ai-database-vault",
			isDefaultWorkspace: false,
			sessionCount: 1,
			entryCount: 5,
			files: [],
			tasks: [],
			completed: [],
			outputs: [],
			risks: [],
			followUps: [],
			toolCounts: [],
		},
	],
	tasks: [],
	completed: [{ time: "10:00", text: "已完成日报 MVP" }],
	assistantNotes: [{ time: "10:01", text: "已生成日报并保存" }],
	followUps: [{ time: "10:02", text: "待确认提醒权限问题" }],
	errors: [],
	blockers: [],
	toolCounts: [{ name: "read", count: 3 }],
	files: ["src/index.ts"],
	scanErrors: [],
};

test("buildSummaryFacts returns redacted structured facts", () => {
	const facts = buildSummaryFacts(report, 5);
	assert.equal(facts.signals[0].type, "completed");
	assert.equal(facts.projects[0].name, "pi-daily");
	assert.equal(facts.projects[1].name, "ai-database-vault");
});

test("buildSummaryPrompt includes markdown instructions and facts", () => {
	const prompt = buildSummaryPrompt(report, 5, "zh-CN");
	assert.match(prompt, /## 项目\/事项一：<项目名或事项名>/);
	assert.match(prompt, /## 项目\/事项二：<项目名或事项名>/);
	assert.match(prompt, /默认工作区/);
	assert.match(prompt, /### 进展/);
	assert.match(prompt, /### 产出/);
	assert.match(prompt, /### 阻塞 \/ 风险/);
	assert.match(prompt, /### 待跟进/);
	assert.match(prompt, /结构化事实 JSON/);
});
