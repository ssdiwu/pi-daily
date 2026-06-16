import { redactText, truncateText } from "./redact.ts";
import { detectLocale, languageForLocale, languageInstructionForLocale } from "./locale.ts";
import { reportLabelsFor } from "./report-labels.ts";
import type { AISummaryResult, ProjectSummary, ReportModel, TimedText } from "./types.ts";

const AI_TIMEOUT_MS = 90_000;
const MAX_ITEMS_PER_SECTION = 8;

type RuntimeModel = any;
type RuntimeContext = any;

interface SummarySignal {
	type: "completed" | "output" | "followUp" | "risk";
	time: string;
	text: string;
}

interface ProjectFacts {
	name: string;
	cwd: string;
	isDefaultWorkspace: boolean;
	sessionCount: number;
	entryCount: number;
	tasks: TimedText[];
	completed: TimedText[];
	outputs: TimedText[];
	risks: TimedText[];
	followUps: TimedText[];
	toolCounts: ProjectSummary["toolCounts"];
	files: string[];
}

interface SummaryFacts {
	date: string;
	window: string;
	stats: ReportModel["stats"];
	projects: ProjectFacts[];
	signals: SummarySignal[];
}

function limitItems(items: TimedText[] = [], maxItems: number, maxLength = 180): TimedText[] {
	return items.slice(0, maxItems).map((item) => ({
		time: item.time || "",
		text: truncateText(redactText(item.text || ""), maxLength),
	}));
}

function buildSignals(report: ReportModel, maxItems: number): SummarySignal[] {
	const toSignal = (type: SummarySignal["type"], item: TimedText): SummarySignal => ({ type, time: item.time || "", text: truncateText(redactText(item.text || ""), 220) });
	return [
		...report.completed.map((item) => toSignal("completed", item)),
		...report.assistantNotes.map((item) => toSignal("output", item)),
		...report.followUps.map((item) => toSignal("followUp", item)),
		...report.errors.map((item) => toSignal("risk", item)),
		...report.blockers.map((item) => toSignal("risk", item)),
	]
		.filter((item) => item.text)
		.slice(0, Math.max(maxItems * 4, 24));
}

function buildProjectFacts(project: ProjectSummary, maxItems: number): ProjectFacts {
	return {
		name: project.projectName,
		cwd: redactText(project.cwd || ""),
		isDefaultWorkspace: project.isDefaultWorkspace,
		sessionCount: project.sessionCount,
		entryCount: project.entryCount,
		tasks: limitItems(project.tasks, maxItems, 160),
		completed: limitItems(project.completed, maxItems, 160),
		outputs: limitItems(project.outputs, maxItems, 160),
		risks: limitItems(project.risks, maxItems, 160),
		followUps: limitItems(project.followUps, maxItems, 160),
		toolCounts: project.toolCounts.slice(0, 10),
		files: project.files.slice(0, 12).map((file) => redactText(file)),
	};
}

export function buildSummaryFacts(report: ReportModel, maxItems = MAX_ITEMS_PER_SECTION): SummaryFacts {
	return {
		date: report.date,
		window: report.window.label,
		stats: report.stats,
		projects: report.projects.map((project) => buildProjectFacts(project, maxItems)),
		signals: buildSignals(report, maxItems),
	};
}

export function buildSummaryPrompt(report: ReportModel, maxItems = MAX_ITEMS_PER_SECTION, locale?: string): string {
	const facts = buildSummaryFacts(report, maxItems);
	const lang = languageForLocale(locale);
	const labels = reportLabelsFor(lang);
	const langHint = languageInstructionForLocale(locale);
	return [
		"你是日报整理助手。请基于给定的结构化工作事实，生成一份按真实项目和工作事项分组的日报总结。",
		langHint,
		"核心要求：不要按全局的完成事项/关键产出/阻塞/待跟进混排；真实项目目录必须逐一输出，每个真实项目都必须有自己的章节。",
		"如果 project.isDefaultWorkspace 为 true，说明它只是默认工作区/用户主目录，不是项目；必须把其中内容拆成实际工作事项。",
		"每个项目或事项章节至少包含：进展、产出、阻塞 / 风险、待跟进。",
		"不要回放用户原始提问，不要逐条复述聊天记录。要合并同一项目/事项里的多轮对话，提炼成可交付结果和下一步动作。",
		"严格输出 Markdown，并使用以下结构和本地化标题：",
		`# ${labels.reportTitle(report.date)}`,
		`在标题下方依次写：${labels.generatedAt}、${labels.window}（统计范围必须使用 facts.window）。`,
		`## ${labels.overview}`,
		"用 3-5 条 bullet 概括今天做了哪几类事情。",
		"## <项目名或事项名一>",
		"### 进展",
		"### 产出",
		"### 阻塞 / 风险",
		"### 待跟进",
		"## <项目名或事项名二>",
		"### 进展",
		"### 产出",
		"### 阻塞 / 风险",
		"### 待跟进",
		`## ${labels.completed}（跨项目）/ ${labels.keyOutputs}（跨项目） / 跨项目观察 / ${labels.filesAndTools}`,
		"规则：",
		"- 每个项目/事项都必须有上述 4 个三级标题；没有内容时写“暂无”。",
		"- 对真实项目目录，项目名直接使用 cwd 对应项目名或目录名。",
		"- 不要让某个项目或事项的内容覆盖另一个项目；每个真实项目都要单独总结。",
		"- 跨项目观察只写共性问题、共性进展或共性风险。",
		"- 工具与文件活动只做简短归纳，不要列出大量伪路径或内部字段。",
		"下面是脱敏后的结构化事实 JSON：",
		JSON.stringify(facts, null, 2),
	].join("\n\n");
}

// 加载 @earendil-works/pi-ai 的窄入口 stream.js（只含 complete/completeSimple），避免导入整个包入口。
// 用变量 specifier 的标准动态 import：运行时 jiti 原生支持；tsc 因非字面量 specifier 返回 any，不展开 pi-ai 类型树（否则 tsc 会卡在 openai 等传递依赖）。
async function loadPiAIStream(): Promise<{ complete: (...args: any[]) => Promise<any> }> {
	const streamUrl = new URL("./stream.js", import.meta.resolve("@earendil-works/pi-ai")).href;
	const mod: any = await import(streamUrl);
	return mod as { complete: (...args: any[]) => Promise<any> };
}

async function callCurrentModel(model: RuntimeModel, promptText: string, ctx: RuntimeContext): Promise<string> {
	if (!model) {
		throw new Error("current session model is not available");
	}
	let auth: any;
	try {
		auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
	} catch (error) {
		throw new Error(`auth failed: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!auth?.ok) {
		throw new Error(`auth not ok: ${auth?.error || "unknown"}`);
	}
	if (!auth.apiKey) {
		throw new Error("auth missing apiKey");
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(new Error("pi-daily AI summary timed out")), AI_TIMEOUT_MS);
	try {
		const { complete } = await loadPiAIStream();
		const response: any = await complete(
			model,
			{
				messages: [{ role: "user", content: [{ type: "text", text: promptText }], timestamp: Date.now() }],
			},
			{ apiKey: auth.apiKey, headers: auth.headers, maxTokens: 1800, signal: controller.signal },
		);
		if (response.errorMessage) {
			throw new Error(response.errorMessage);
		}
		return response.content.filter((item: any) => item.type === "text").map((item: any) => item.text).join("\n").trim();
	} finally {
		clearTimeout(timeoutId);
	}
}

export async function summarizeReportWithAI(report: ReportModel, ctx: RuntimeContext, locale?: string): Promise<AISummaryResult> {
	const prompt = buildSummaryPrompt(report, MAX_ITEMS_PER_SECTION, locale);
	const model = ctx.model;
	const modelId = model ? `${model.provider}/${model.id}` : "";
	try {
		const markdown = await callCurrentModel(model, prompt, ctx);
		if (markdown) {
			return { markdown, source: "ai", model: modelId, errors: [] };
		}
		return { markdown: "", source: "fallback", errors: [`${modelId || "current model"}: empty response`] };
	} catch (error) {
		return { markdown: "", source: "fallback", errors: [`${modelId || "current model"}: ${error instanceof Error ? error.message : String(error)}`] };
	}
}
