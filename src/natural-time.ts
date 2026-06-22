import { addDays, buildTimeWindow, buildWindowLabel, formatLocalDateTime, getLocalDateString, startOfLocalDate, timeToMinutes } from "./time-window.ts";
import type { TimeWindow } from "./types.ts";

interface Clock {
	hour: number;
	minute: number;
}

interface NaturalDailyParseResult {
	date: string;
	window: TimeWindow;
	confirmation: {
		title: string;
		message: string;
	};
}

const CHINESE_DIGIT: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const ADVANCED_FLAG_PATTERN = /--(?:today|day-start|since|until|from|to)\b|\d{4}-\d{2}-\d{2}/;

function normalizeText(text: string): string {
	return text
		.replace(/--save\b/g, " ")
		.replace(/--project\s+\S+/g, " ")
		.replace(/[，,。；;！!？?]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function parseChineseNumber(value: string): number | undefined {
	if (value === "十") return 10;
	if (value.startsWith("十")) return 10 + (CHINESE_DIGIT[value[1]] ?? 0);
	if (value.endsWith("十")) return (CHINESE_DIGIT[value[0]] ?? 1) * 10;
	if (value.includes("十")) return (CHINESE_DIGIT[value[0]] ?? 1) * 10 + (CHINESE_DIGIT[value[2]] ?? 0);
	return value.length === 1 ? CHINESE_DIGIT[value] : undefined;
}

function parseHour(value: string): number | undefined {
	if (/^\d+$/.test(value)) return Number(value);
	return parseChineseNumber(value);
}

function parseClock(text: string): Clock | undefined {
	const match = text.match(/(凌晨|半夜|早上|上午|中午|下午|傍晚|晚上|今晚)?\s*([0-2]?\d|[一二两三四五六七八九十]+)\s*(?::|点|时)?\s*([0-5]\d|半)?/);
	if (!match) return undefined;
	let hour = parseHour(match[2]);
	if (hour === undefined || hour > 23) return undefined;
	const minute = match[3] === "半" ? 30 : Number(match[3] || 0);
	const period = match[1] || "";
	if (/下午|傍晚|晚上|今晚/.test(period) && hour < 12) hour += 12;
	if (period === "中午" && hour < 11) hour += 12;
	return minute >= 0 && minute <= 59 ? { hour, minute } : undefined;
}

function formatClock(clock: Clock): string {
	return `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`;
}

function dateByKeyword(text: string, now: Date): string {
	if (/前天/.test(text)) return getLocalDateString(addDays(now, -2));
	if (/昨天|昨日|昨晚|昨夜/.test(text)) return getLocalDateString(addDays(now, -1));
	if (/明天|明早/.test(text)) return getLocalDateString(addDays(now, 1));
	return getLocalDateString(now);
}

function withClock(date: string, clock: Clock): Date {
	const result = startOfLocalDate(date);
	result.setHours(clock.hour, clock.minute, 0, 0);
	return result;
}

function withConfirmation(date: string, window: TimeWindow): NaturalDailyParseResult {
	return {
		date,
		window,
		confirmation: {
			title: "确认日报时间范围？",
			message: `我理解为：${window.label}`,
		},
	};
}

function makeWindow(date: string, startClock: Clock, endClock: Clock): NaturalDailyParseResult {
	return makeWindowFromParts(date, startClock, date, endClock);
}

function makeWindowFromParts(startDate: string, startClock: Clock, endDate: string, endClock: Clock): NaturalDailyParseResult {
	const start = withClock(startDate, startClock);
	const end = withClock(endDate, endClock);
	if (end <= start) {
		const rolled = addDays(end, 1);
		return withConfirmation(startDate, { start, end: rolled, label: buildWindowLabel(start, rolled) });
	}
	return withConfirmation(startDate, { start, end, label: buildWindowLabel(start, end) });
}

function parseRecentHours(text: string, now: Date): NaturalDailyParseResult | undefined {
	const match = text.match(/(?:最近|过去|近)\s*(\d+)\s*(?:小时|h)/i);
	if (!match) return undefined;
	const end = new Date(now);
	const start = new Date(now);
	start.setHours(start.getHours() - Number(match[1]), start.getMinutes(), 0, 0);
	const date = getLocalDateString(start);
	return withConfirmation(date, { start, end, label: `${formatLocalDateTime(start)} → ${formatLocalDateTime(end)}` });
}

function parseWorkdayBoundary(text: string, now: Date): NaturalDailyParseResult | undefined {
	if (!/(工作日|算昨天|算前一天)/.test(text)) return undefined;
	const clock = parseClock(text);
	if (!clock) return undefined;
	const nowMinutes = now.getHours() * 60 + now.getMinutes();
	const date = nowMinutes < timeToMinutes(clock) ? getLocalDateString(addDays(now, -1)) : getLocalDateString(now);
	return withConfirmation(date, buildTimeWindow(date, formatClock(clock)));
}

function parseDefaultPeriod(text: string, now: Date): NaturalDailyParseResult | undefined {
	if (/昨晚|昨夜|昨天晚上|昨晚加班/.test(text)) return makeWindow(getLocalDateString(addDays(now, -1)), { hour: 18, minute: 0 }, { hour: 5, minute: 0 });
	if (/今晚|今天晚上/.test(text)) return makeWindow(getLocalDateString(now), { hour: 18, minute: 0 }, { hour: 5, minute: 0 });
	if (/今天凌晨/.test(text)) return makeWindow(getLocalDateString(now), { hour: 0, minute: 0 }, { hour: 5, minute: 0 });
	if (/昨天|昨日/.test(text)) {
		const date = getLocalDateString(addDays(now, -1));
		return withConfirmation(date, buildTimeWindow(date, "00:00"));
	}
	if (/今天|今日/.test(text)) {
		const date = getLocalDateString(now);
		return withConfirmation(date, buildTimeWindow(date, "00:00"));
	}
	return undefined;
}

// 从一段文本里抽出绝对日期（如 "6月21号"、"2026年6月21日"），并返回剩余文本。
// 剩余文本里的时钟解析才不会把 "6月" 的数字误读成小时。
const ABSOLUTE_DATE_PATTERN = /(?:\d{4}\s*[-年]\s*)?(\d{1,2})\s*[-月]\s*(\d{1,2})\s*[号日]?/;

function parseAbsoluteDate(segment: string, now: Date): { date: string | undefined; rest: string } {
	if (!/\d{1,2}\s*[-月]\s*\d{1,2}/.test(segment)) return { date: undefined, rest: segment };
	const match = segment.match(ABSOLUTE_DATE_PATTERN);
	if (!match) return { date: undefined, rest: segment };
	const year = now.getFullYear();
	const month = Number(match[1]);
	const day = Number(match[2]);
	if (month < 1 || month > 12 || day < 1 || day > 31) return { date: undefined, rest: segment };
	const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
	return { date, rest: segment.replace(match[0], " ") };
}

function parseDateAndClock(segment: string, now: Date): { date: string | undefined; clock: Clock | undefined } {
	const { date, rest } = parseAbsoluteDate(segment, now);
	return { date, clock: parseClock(rest) };
}

function parseClockRange(text: string, now: Date): NaturalDailyParseResult | undefined {
	const match = text.match(/(.+?)(?:到|至|—|-)\s*(.+)/);
	if (!match) return undefined;
	const startSeg = match[1];
	const endSeg = match[2];
	const startParsed = parseDateAndClock(startSeg, now);
	const endParsed = parseDateAndClock(endSeg, now);
	const startClock = startParsed.clock || (/昨晚|昨夜|昨天晚上|今晚|晚上/.test(startSeg) ? { hour: 18, minute: 0 } : undefined);
	const endClock = endParsed.clock || (/凌晨/.test(endSeg) ? { hour: 5, minute: 0 } : undefined);
	if (!startClock || !endClock) return undefined;
	const startDate = startParsed.date || dateByKeyword(startSeg, now);
	const endDate = endParsed.date || startDate;
	return makeWindowFromParts(startDate, startClock, endDate, endClock);
}

export function parseNaturalDailyArgs(rawArgs: string, now = new Date()): NaturalDailyParseResult | undefined {
	if (ADVANCED_FLAG_PATTERN.test(rawArgs)) return undefined;
	const text = normalizeText(rawArgs);
	if (!text) return undefined;
	return parseRecentHours(text, now) || parseWorkdayBoundary(text, now) || parseClockRange(text, now) || parseDefaultPeriod(text, now);
}
