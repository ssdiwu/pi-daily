import { parseNaturalDailyArgs } from "./natural-time.ts";
import { parseNaturalDailyArgsWithAI } from "./natural-time-ai.ts";
import {
	DEFAULT_DAY_START,
	addDays,
	buildTimeWindow,
	getLocalDateString,
	parseLocalDateTime,
	parseTime,
	timeToMinutes,
} from "./time-window.ts";
import type { DailyOptions } from "./types.ts";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 凌晨几点前算“属于昨天的工作日”。与 --day-start 惯例一致。
const EARLY_MORNING_HOUR = 5;

function getPreviousLocalDateString(now: Date): string {
	return getLocalDateString(addDays(now, -1));
}

function inferCurrentWorkDate(now: Date, dayStartText: string, sinceText?: string, untilText?: string, fromText?: string): string {
	const from = fromText ? parseLocalDateTime(fromText) : undefined;
	if (from) return getLocalDateString(from);

	const nowMinutes = now.getHours() * 60 + now.getMinutes();
	const dayStart = parseTime(dayStartText);
	if (dayStart && dayStartText !== DEFAULT_DAY_START && nowMinutes < timeToMinutes(dayStart)) {
		return getPreviousLocalDateString(now);
	}

	const since = sinceText ? parseTime(sinceText) : undefined;
	const until = untilText ? parseTime(untilText) : undefined;
	if (since && until && timeToMinutes(until) <= timeToMinutes(since) && nowMinutes < timeToMinutes(until)) {
		return getPreviousLocalDateString(now);
	}

	return getLocalDateString(now);
}

function normalizeDayStart(value: string | undefined): string {
	return parseTime(value || "") ? value! : DEFAULT_DAY_START;
}

interface ParsedFlags {
	date: string;
	hasExplicitDate: boolean;
	dayStart: string;
	hasExplicitWindow: boolean;
	since?: string;
	until?: string;
	from?: string;
	to?: string;
	options: Omit<DailyOptions, "date" | "window">;
}

// 把 rawArgs 拆成 flags 状态。parseDailyArgs（同步正则）和 parseDailyArgsAsync（LLM 优先）共用。
function parseFlags(rawArgs: string, now: Date): ParsedFlags {
	const tokens = rawArgs.trim().split(/\s+/).filter(Boolean);
	let date = getLocalDateString(now);
	let hasExplicitDate = false;
	let dayStart = DEFAULT_DAY_START;
	let hasExplicitWindow = false;
	let since: string | undefined;
	let until: string | undefined;
	let from: string | undefined;
	let to: string | undefined;
	const options: Omit<DailyOptions, "date" | "window"> = {
		save: false,
		project: "all",
	};

	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index];

		if (token === "--today") {
			date = getLocalDateString(now);
			hasExplicitDate = false;
			continue;
		}

		if (token === "--save") {
			options.save = true;
			continue;
		}

		if (token === "--project") {
			options.project = tokens[index + 1] || "all";
			index += 1;
			continue;
		}

		if (token === "--day-start") {
			dayStart = normalizeDayStart(tokens[index + 1]);
			hasExplicitWindow = true;
			index += 1;
			continue;
		}

		if (token === "--since") {
			since = tokens[index + 1];
			hasExplicitWindow = true;
			index += 1;
			continue;
		}

		if (token === "--until") {
			until = tokens[index + 1];
			hasExplicitWindow = true;
			index += 1;
			continue;
		}

		if (token === "--from") {
			from = tokens[index + 1];
			hasExplicitWindow = true;
			index += 1;
			continue;
		}

		if (token === "--to") {
			to = tokens[index + 1];
			hasExplicitWindow = true;
			index += 1;
			continue;
		}

		if (DATE_PATTERN.test(token)) {
			date = token;
			hasExplicitDate = true;
		}
	}

	return { date, hasExplicitDate, dayStart, hasExplicitWindow, since, until, from, to, options };
}

// 从 flags 状态构造最终 DailyOptions（advanced/explicit-date 路径）。
function buildOptionsFromFlags(flags: ParsedFlags, now: Date): DailyOptions {
	const { date, dayStart, since, until, from, to, options } = flags;
	const finalDate = !flags.hasExplicitDate ? inferCurrentWorkDate(now, dayStart, since, until, from) : date;
	return {
		date: finalDate,
		...options,
		window: buildTimeWindow(finalDate, dayStart, since, until, from, to),
	};
}

// 同步版：纯本地解析（正则兜底）。保留给无 ctx 的场景（单测、CLI 直调）。
// parseDailyArgs 默认走纯本地解析；有 ctx 时应调用 parseDailyArgsAsync 走 LLM 语义解析。
export function parseDailyArgs(rawArgs = "", now = new Date()): DailyOptions {
	const flags = parseFlags(rawArgs, now);

	if (!flags.hasExplicitDate && !flags.hasExplicitWindow) {
		// 凌晨 0-5 点跑默认 /daily：自动用“昨天 05:00 → 今天 05:00”工作日窗口，
		// 让昨天白天 + 跨夜加班都进同一个日报。阈值与 --day-start 惯例一致。
		const effectiveDayStart = now.getHours() < EARLY_MORNING_HOUR
			? normalizeDayStart(`${String(EARLY_MORNING_HOUR).padStart(2, "0")}:00`)
			: flags.dayStart;
		const natural = parseNaturalDailyArgs(rawArgs, now);
		if (natural) {
			return {
				date: natural.date,
				...flags.options,
				window: natural.window,
				confirmation: natural.confirmation,
			};
		}
		// 正则也无匹配：用推断日期 + 默认 dayStart（含凌晨工作日边界）构造窗口。
		const finalDate = inferCurrentWorkDate(now, effectiveDayStart, flags.since, flags.until, flags.from);
		return {
			date: finalDate,
			...flags.options,
			window: buildTimeWindow(finalDate, effectiveDayStart, flags.since, flags.until, flags.from, flags.to),
		};
	}

	return buildOptionsFromFlags(flags, now);
}

// 有 ctx 时的主入口：先试 LLM 语义解析，失败回退正则版。
// 设计：非 advanced-flag 输入优先让 LLM 理解真实时间范围（自然语言表达无穷尽，
// 正则易把"6月"里的数字误读成小时）；LLM 不可用/返回非法结构时回退正则。
export async function parseDailyArgsAsync(rawArgs = "", now = new Date(), ctx?: any): Promise<DailyOptions> {
	if (!ctx) return parseDailyArgs(rawArgs, now);
	const flags = parseFlags(rawArgs, now);

	// 只有无 explicit date 且无 advanced flag 时，才走语义解析；否则用 flags 路径。
	if (!flags.hasExplicitDate && !flags.hasExplicitWindow) {
		try {
			const aiShape = await parseNaturalDailyArgsWithAI(rawArgs, ctx, now);
			if (aiShape) {
				return {
					date: aiShape.date,
					...flags.options,
					window: aiShape.window,
					confirmation: {
						title: "确认日报时间范围？",
						message: `我理解为：${aiShape.window.label}`,
					},
				};
			}
		} catch {
			// LLM 解析失败，回退同步正则版。
		}
		// 正则回退（保留 confirmation，与 withConfirmation 一致）
		const fallback = parseDailyArgs(rawArgs, now);
		if (!fallback.confirmation && fallback.window) {
			fallback.confirmation = {
				title: "确认日报时间范围？",
				message: `我理解为：${fallback.window.label}`,
			};
		}
		return fallback;
	}

	return buildOptionsFromFlags(flags, now);
}
