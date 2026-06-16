import { parseNaturalDailyArgs } from "./natural-time.ts";
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

export function parseDailyArgs(rawArgs = "", now = new Date()): DailyOptions {
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

	if (!hasExplicitDate) {
		if (!hasExplicitWindow) {
			// 凌晨 0-5 点跑默认 /daily：自动用“昨天 05:00 → 今天 05:00”工作日窗口，
			// 让昨天白天 + 跨夜加班都进同一个日报。阈值与 --day-start 惯例一致。
			if (now.getHours() < EARLY_MORNING_HOUR) {
				dayStart = normalizeDayStart(`${String(EARLY_MORNING_HOUR).padStart(2, "0")}:00`);
			}
			const natural = parseNaturalDailyArgs(rawArgs, now);
			if (natural) {
				return {
					date: natural.date,
					...options,
					window: natural.window,
					confirmation: natural.confirmation,
				};
			}
		}
		date = inferCurrentWorkDate(now, dayStart, since, until, from);
	}

	return {
		date,
		...options,
		window: buildTimeWindow(date, dayStart, since, until, from, to),
	};
}
