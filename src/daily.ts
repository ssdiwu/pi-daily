import { promises as fs } from "node:fs";
import path from "node:path";

import { parseDailyArgs } from "./args.ts";
import { summarizeReportWithAI } from "./ai-summary.ts";
import { detectLocale } from "./locale.ts";
import { generateDailyReportModel, getDefaultReportPath } from "./report-model.ts";
import { renderMarkdownReport } from "./markdown-render.ts";
import type { BuildDailyResult, BuildDailyRuntime } from "./types.ts";

export async function buildDailyReport(rawArgs = "", runtime: BuildDailyRuntime = {}): Promise<BuildDailyResult> {
	const options = runtime.options || parseDailyArgs(rawArgs, runtime.now || new Date());
	const locale = detectLocale();
	const report = await generateDailyReportModel({
		date: options.date,
		window: options.window,
		project: options.project,
		currentCwd: runtime.currentCwd || "",
		sessionRoot: runtime.sessionRoot,
	});
	const fallbackMarkdown = renderMarkdownReport(report, locale);
	if (!runtime.ctx) {
		return { options, report, markdown: fallbackMarkdown, source: "fallback", errors: [] };
	}
	const aiResult = await summarizeReportWithAI(report, runtime.ctx, locale);
	const errors = aiResult.errors || [];
	const diagnostic = errors.length > 0 ? `\n\n---\n\n> pi-daily AI summary fallback: ${errors.join("; ")}` : "";
	return {
		options,
		report,
		markdown: aiResult.markdown || `${fallbackMarkdown.trim()}${diagnostic}\n`,
		source: aiResult.source,
		model: aiResult.model,
		errors,
	};
}

export async function saveDailyReport(markdown: string, date: string, outputPath = ""): Promise<string> {
	const targetPath = outputPath || getDefaultReportPath(date);
	await fs.mkdir(path.dirname(targetPath), { recursive: true });
	await fs.writeFile(targetPath, markdown, "utf8");
	return targetPath;
}
