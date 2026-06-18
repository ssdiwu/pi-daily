import assert from "node:assert/strict";
import test from "node:test";

import { buildSummaryFacts, buildSummaryPrompt } from "../src/ai-summary.ts";

const report = {
	date: "2026-06-12",
	window: { start: new Date("2026-06-12T00:00:00"), end: new Date("2026-06-13T00:00:00"), label: "2026-06-12 00:00 → 2026-06-13 00:00" },
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
	assert.equal(facts.window, "2026-06-12 00:00 → 2026-06-13 00:00");
});

test("buildSummaryPrompt includes markdown instructions and facts", () => {
	const prompt = buildSummaryPrompt(report, 5, "zh-CN");
	assert.match(prompt, /# 2026-06-12 工作日报/);
	assert.match(prompt, /<项目名或事项一>/);
	assert.match(prompt, /<项目名或事项二>/);
	assert.match(prompt, /### 进展/);
	assert.match(prompt, /### 产出/);
	assert.match(prompt, /### 阻塞 \/ 风险/);
	assert.match(prompt, /### 待跟进/);
	assert.match(prompt, /今日概览/);
	assert.match(prompt, /请用简体中文输出整份日报/);
	assert.match(prompt, /统计范围/);
	assert.match(prompt, /结构化事实 JSON/);
});

test("buildSummaryPrompt localizes prompt scaffolding for all supported locales", () => {
	const cases = [
		{ locale: "zh-CN", assistant: "你是日报整理助手", overview: "## 今日概览", placeholder: "## <项目名或事项一>", progress: "### 进展", facts: "结构化事实 JSON", allowChinese: true },
		{ locale: "zh-TW", assistant: "你是日報整理助手", overview: "## 今日概覽", placeholder: "## <專案名或事項一>", progress: "### 進展", facts: "結構化事實 JSON", allowChinese: true },
		{ locale: "ja-JP", assistant: "あなたは日報整理アシスタントです", overview: "## 本日の概要", placeholder: "## <プロジェクト名または作業項目1>", progress: "### 進捗", facts: "構造化事実 JSON", allowChinese: false },
		{ locale: "ko-KR", assistant: "당신은 일일보고 정리 도우미입니다", overview: "## 오늘 개요", placeholder: "## <프로젝트명 또는 작업 항목 1>", progress: "### 진행 상황", facts: "구조화 사실 JSON", allowChinese: false },
		{ locale: "de-DE", assistant: "Du bist ein Assistent zum Erstellen von Tagesberichten", overview: "## Überblick", placeholder: "## <Projektname oder Arbeitspunkt 1>", progress: "### Fortschritt", facts: "strukturierten Fakten", allowChinese: false },
		{ locale: "fr-FR", assistant: "Tu es un assistant de synthèse quotidienne", overview: "## Aperçu", placeholder: "## <Nom du projet ou élément de travail 1>", progress: "### Progression", facts: "faits structurés", allowChinese: false },
		{ locale: "es-ES", assistant: "Eres un asistente para resumir informes diarios", overview: "## Resumen", placeholder: "## <Nombre del proyecto o tarea 1>", progress: "### Progreso", facts: "hechos estructurados", allowChinese: false },
		{ locale: "pt-BR", assistant: "Você é um assistente de consolidação de relatório diário", overview: "## Visão geral", placeholder: "## <Nome do projeto ou item de trabalho 1>", progress: "### Progresso", facts: "fatos estruturados", allowChinese: false },
		{ locale: "ru-RU", assistant: "Ты помощник по подготовке ежедневного отчёта", overview: "## Обзор", placeholder: "## <Название проекта или рабочего пункта 1>", progress: "### Прогресс", facts: "структурированными фактами", allowChinese: false },
		{ locale: "ar-SA", assistant: "أنت مساعد لتنظيم التقرير اليومي", overview: "## نظرة عامة", placeholder: "## <اسم المشروع أو عنصر العمل 1>", progress: "### التقدم", facts: "الحقائق المهيكلة", allowChinese: false },
		{ locale: "en-US", assistant: "You are a daily report assistant", overview: "## Overview", placeholder: "## <Project or work item 1>", progress: "### Progress", facts: "redacted structured facts JSON", allowChinese: false },
	] as const;

	for (const testCase of cases) {
		const prompt = buildSummaryPrompt(report, 5, testCase.locale);
		assert.match(prompt, new RegExp(testCase.assistant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
		assert.match(prompt, new RegExp(testCase.overview.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
		assert.match(prompt, new RegExp(testCase.placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
		assert.match(prompt, new RegExp(testCase.progress.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
		assert.match(prompt, new RegExp(testCase.facts.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
		assert.doesNotMatch(prompt, /undefined/);
		if (!testCase.allowChinese) {
			assert.doesNotMatch(prompt, /### 进展/);
			assert.doesNotMatch(prompt, /<项目名或事项一>/);
		}
	}
});
