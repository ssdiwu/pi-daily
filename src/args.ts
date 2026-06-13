import type { DailyOptions } from "./types.ts";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getLocalDateString(now = new Date()): string {
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function parseDailyArgs(rawArgs = "", now = new Date()): DailyOptions {
	const tokens = rawArgs.trim().split(/\s+/).filter(Boolean);
	const options: DailyOptions = {
		date: getLocalDateString(now),
		save: false,
		project: "all",
	};

	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index];

		if (token === "--today") {
			options.date = getLocalDateString(now);
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

		if (DATE_PATTERN.test(token)) {
			options.date = token;
		}
	}

	return options;
}
