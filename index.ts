import { parseDailyArgsAsync } from "./src/args.ts";
import { buildDailyReport, saveDailyReport } from "./src/daily.ts";
import type { ReportStats } from "./src/types.ts";

const PI_DAILY_BUILD = "0.1.3";

interface DailyReportDetails {
	build: string;
	date: string;
	window: string;
	stats: ReportStats;
	source: string;
	model?: string;
	errors?: string[];
	savedPath?: string;
}

interface PiDailyApi {
	registerCommand(name: string, command: { description: string; handler: (args: string, ctx: any) => Promise<void> }): void;
	sendMessage(message: { customType: string; content: string; display: boolean; details: DailyReportDetails }): void;
}

export default function piDaily(pi: PiDailyApi) {
	pi.registerCommand("daily", {
		description: "Generate a daily work report from local Pi session activity",
		handler: async (args, ctx) => {
			const options = await parseDailyArgsAsync(args, new Date(), ctx);
			if (options.confirmation && ctx.hasUI) {
				const ok = await ctx.ui.confirm(options.confirmation.title, options.confirmation.message);
				if (!ok) {
					ctx.ui.notify("pi-daily: cancelled", "warning");
					return;
				}
			}

			if (ctx.hasUI) {
				ctx.ui.setStatus("pi-daily", ctx.ui.theme.fg("accent", "pi-daily: generating..."));
				ctx.ui.notify("pi-daily: generating report...", "info");
			}

			try {
				const { report, markdown, source, model, errors } = await buildDailyReport(args, {
					currentCwd: ctx.cwd,
					ctx,
					build: PI_DAILY_BUILD,
					options,
				});

				let savedPath = "";
				if (options.save) {
					savedPath = await saveDailyReport(markdown, report.date);
					if (ctx.hasUI) {
						ctx.ui.notify(`pi-daily saved: ${savedPath}`, "info");
					} else {
						console.log(`pi-daily saved: ${savedPath}`);
					}
				}

				if (ctx.hasUI) {
					const reason = errors?.[0] ? ` (${errors[0]})` : "";
					ctx.ui.notify(source === "ai" ? `pi-daily: AI summarized via ${model}` : `pi-daily: fallback summary${reason}`, "info");
					ctx.ui.setStatus("pi-daily", ctx.ui.theme.fg(source === "ai" ? "success" : "warning", `pi-daily: ${source} · ${report.stats.entryCount} entries`));
				}

				pi.sendMessage({
					customType: "pi-daily-report",
					content: markdown.trim(),
					display: true,
					details: {
						build: PI_DAILY_BUILD,
						date: report.date,
						window: report.window.label,
						stats: report.stats,
						source,
						model,
						errors,
						savedPath: savedPath || undefined,
					},
				});
			} catch (error) {
				if (ctx.hasUI) {
					ctx.ui.setStatus("pi-daily", ctx.ui.theme.fg("error", "pi-daily: failed"));
					ctx.ui.notify(`pi-daily failed: ${error instanceof Error ? error.message : String(error)}`, "error");
				}
				throw error;
			}
		},
	});
}
