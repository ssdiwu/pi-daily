import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { buildDailyReport, saveDailyReport } from "./src/daily.ts";

const PI_DAILY_BUILD = "0.0.1-ts-2026-06-12";

export default function piDaily(pi: ExtensionAPI) {
	pi.registerCommand("daily", {
		description: "Generate a daily work report from local Pi session activity",
		handler: async (args, ctx) => {
			if (ctx.hasUI) {
				ctx.ui.notify("pi-daily: generating report...", "info");
			}

			const { options, report, markdown, source, model, errors } = await buildDailyReport(args, {
				currentCwd: ctx.cwd,
				ctx,
				build: PI_DAILY_BUILD,
			});

			if (options.save) {
				const savedPath = await saveDailyReport(markdown, report.date);
				if (ctx.hasUI) {
					ctx.ui.notify(`pi-daily saved: ${savedPath}`, "info");
				} else {
					console.log(`pi-daily saved: ${savedPath}`);
				}
			}

			if (ctx.hasUI) {
				const reason = errors?.[0] ? ` (${errors[0]})` : "";
				ctx.ui.notify(source === "ai" ? `pi-daily: AI summarized via ${model}` : `pi-daily: fallback summary${reason}`, "info");
			}

			pi.sendMessage({
				customType: "pi-daily-report",
				content: markdown.trim(),
				display: true,
				details: {
					build: PI_DAILY_BUILD,
					date: report.date,
					stats: report.stats,
					source,
					model,
					errors,
				},
			});
		},
	});
}
