import type { TimeWindow } from "./types.ts";

const TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}[T ]([01]?\d|2[0-3]):([0-5]\d)$/;

export const DEFAULT_DAY_START = "00:00";

export interface TimeParts {
	hour: number;
	minute: number;
}

export function getLocalDateString(now = new Date()): string {
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function formatTimePart(value: number): string {
	return String(value).padStart(2, "0");
}

export function formatLocalDateTime(date: Date): string {
	return `${getLocalDateString(date)} ${formatTimePart(date.getHours())}:${formatTimePart(date.getMinutes())}`;
}

export function parseTime(value: string): TimeParts | undefined {
	const match = value.match(TIME_PATTERN);
	if (!match) return undefined;
	return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function parseLocalDateTime(value: string): Date | undefined {
	if (!DATE_TIME_PATTERN.test(value)) return undefined;
	const [datePart, timePart] = value.replace("T", " ").split(" ");
	const time = parseTime(timePart);
	if (!time) return undefined;
	const [year, month, day] = datePart.split("-").map(Number);
	return new Date(year, month - 1, day, time.hour, time.minute, 0, 0);
}

export function startOfLocalDate(date: string): Date {
	const [year, month, day] = date.split("-").map(Number);
	return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

export function timeToMinutes(time: TimeParts): number {
	return time.hour * 60 + time.minute;
}

export function setLocalTime(date: Date, timeText: string): Date {
	const time = parseTime(timeText) || parseTime(DEFAULT_DAY_START)!;
	const result = new Date(date);
	result.setHours(time.hour, time.minute, 0, 0);
	return result;
}

export function buildWindowLabel(start: Date, end: Date, dayStart?: string): string {
	const suffix = dayStart && dayStart !== DEFAULT_DAY_START ? `，工作日从 ${dayStart} 开始` : "";
	return `${formatLocalDateTime(start)} → ${formatLocalDateTime(end)}${suffix}`;
}

export function buildTimeWindow(date: string, dayStartText: string, sinceText?: string, untilText?: string, fromText?: string, toText?: string): TimeWindow {
	let start = setLocalTime(startOfLocalDate(date), dayStartText);
	let end = addDays(start, 1);

	const from = fromText ? parseLocalDateTime(fromText) : undefined;
	const to = toText ? parseLocalDateTime(toText) : undefined;
	if (from) start = from;
	if (to) end = to;

	const since = sinceText ? parseTime(sinceText) : undefined;
	if (since) {
		start = setLocalTime(startOfLocalDate(date), sinceText!);
	}

	const until = untilText ? parseTime(untilText) : undefined;
	if (until) {
		end = setLocalTime(startOfLocalDate(date), untilText!);
		if (end <= start) end = addDays(end, 1);
	}

	if (end <= start) {
		end = addDays(start, 1);
	}

	return {
		start,
		end,
		label: buildWindowLabel(start, end, dayStartText),
		dayStart: dayStartText,
	};
}
