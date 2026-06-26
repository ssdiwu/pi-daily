import { loadPiAICompleteModule } from "./pi-ai-loader.ts";
import { addDays, buildWindowLabel, getLocalDateString, startOfLocalDate } from "./time-window.ts";
import type { TimeWindow } from "./types.ts";

// 用 LLM 理解自然语言时间范围，正则版（natural-time.ts）作为离线兜底。
// 设计理由：自然语言时间表达无穷尽（"6月21号凌晨5点到6月22号凌晨5点"、
// "上周末加班到现在"、"把昨天下午那段时间"），正则永远追不完，且易把
// "6月"里的数字误读成小时。交给 LLM 做语义解析，正则只兜网络/模型不可用的情形。

type RuntimeModel = any;
type RuntimeContext = any;

export interface AITimeWindowResult {
	start: string; // ISO-like local: YYYY-MM-DDTHH:mm
	end: string; // ISO-like local: YYYY-MM-DDTHH:mm
	confidence?: "high" | "medium" | "low";
}

interface NaturalDailyParseShape {
	date: string;
	window: TimeWindow;
}

const AI_TIMEOUT_MS = 30_000;

function buildTimeParsePrompt(rawArgs: string, now: Date): string {
	const nowIso = `${getLocalDateString(now)}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
	return [
		"你是时间范围解析器。把用户的自然语言时间描述解析成结构化的本地时间窗口（起止均为本地时区，不要转 UTC）。",
		"",
		"当前本地时间：" + nowIso,
		"",
		"规则：",
		"- 只输出一个 JSON 对象，不要任何解释、Markdown 代码块或多余文字。",
		'- 字段：{"start":"YYYY-MM-DDTHH:mm","end":"YYYY-MM-DDTHH:mm","confidence":"high|medium|low"}',
		"- start 和 end 必须是合法的本地日期时间，end 必须严格晚于 start。",
		'- 若用户说"昨天/昨天晚上"等相对词，按当前本地时间换算成绝对日期。',
		"- 若用户提到的工作日边界（如凌晨5点算前一天），按该边界归属日期。",
		"- 若完全无法识别时间意图，返回 {\"confidence\":\"low\",\"start\":\"\",\"end\":\"\"}。",
		"",
		"用户输入（已脱敏，仅含时间语义）：",
		rawArgs,
	].join("\n");
}

async function callCurrentModel(model: RuntimeModel, prompt: string, ctx: RuntimeContext): Promise<string> {
	if (!model) throw new Error("current session model is not available");
	const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
	if (!auth?.ok) throw new Error(`auth not ok: ${auth?.error || "unknown"}`);
	if (!auth.apiKey) throw new Error("auth missing apiKey");

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(new Error("pi-daily time-parse timed out")), AI_TIMEOUT_MS);
	try {
		const { complete } = await loadPiAICompleteModule();
		const response: any = await complete(
			model,
			{ messages: [{ role: "user", content: [{ type: "text", text: prompt }], timestamp: Date.now() }] },
			{ apiKey: auth.apiKey, headers: auth.headers, maxTokens: 200, signal: controller.signal },
		);
		if (response.errorMessage) throw new Error(response.errorMessage);
		return response.content.filter((item: any) => item.type === "text").map((item: any) => item.text).join("\n").trim();
	} finally {
		clearTimeout(timeoutId);
	}
}

const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function parseLocalParts(value: string): Date | undefined {
	if (!value || !LOCAL_DATETIME_PATTERN.test(value)) return undefined;
	const [, year, month, day, hour, minute] = value.match(LOCAL_DATETIME_PATTERN)!;
	const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
	return Number.isNaN(d.getTime()) ? undefined : d;
}

function extractJsonObject(text: string): string | undefined {
	// 模型偶尔会包 ```json 代码块或带前后说明，做容错。
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	const candidate = fenced ? fenced[1] : text;
	const start = candidate.indexOf("{");
	const end = candidate.lastIndexOf("}");
	if (start === -1 || end === -1 || end <= start) return undefined;
	return candidate.slice(start, end + 1);
}

// 把 LLM 解析出的起止本地时间归一化成 NaturalDailyParseShape。
// date 字段取 start 的本地日期，供后续保存路径归属。
export function shapeFromAIResult(result: AITimeWindowResult): NaturalDailyParseShape | undefined {
	const start = parseLocalParts(result.start);
	const end = parseLocalParts(result.end);
	if (!start || !end || end <= start) return undefined;
	return {
		date: getLocalDateString(start),
		window: { start, end, label: buildWindowLabel(start, end) },
	};
}

// 对外主入口：用当前会话模型解析自然语言时间范围。
// 成功且结构合法返回 shape；任何失败（无模型/鉴权/网络/非法JSON/end<=start/low confidence）返回 undefined，
// 由调用方回退到正则版 parseNaturalDailyArgs。
export async function parseNaturalDailyArgsWithAI(rawArgs: string, ctx: RuntimeContext, now = new Date()): Promise<NaturalDailyParseShape | undefined> {
	if (!ctx?.model || !ctx?.modelRegistry) return undefined;
	let text: string;
	try {
		text = await callCurrentModel(ctx.model, buildTimeParsePrompt(rawArgs, now), ctx);
	} catch {
		return undefined;
	}
	const jsonText = extractJsonObject(text);
	if (!jsonText) return undefined;
	let parsed: any;
	try {
		parsed = JSON.parse(jsonText);
	} catch {
		return undefined;
	}
	if (parsed?.confidence === "low" || !parsed?.start || !parsed?.end) return undefined;
	return shapeFromAIResult(parsed as AITimeWindowResult);
}

// 工具：把已知的 start/end 日期包装成 confirmation 用的 shape，供回退路径复用。
export function shapeFromWindow(date: string, window: TimeWindow): NaturalDailyParseShape {
	return { date, window };
}

// 仅供单元测试：暴露 prompt 构造，便于断言脱敏与本地时间注入。
export const __test__ = { buildTimeParsePrompt, parseLocalParts, extractJsonObject };
