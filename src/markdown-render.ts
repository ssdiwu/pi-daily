import { languageForLocale } from "./locale.ts";
import { reportLabelsFor } from "./report-labels.ts";
import { redactText } from "./redact.ts";
import type { ReportModel, TimedText } from "./types.ts";

export function renderMarkdownReport(report: ReportModel, locale?: string): string {
	const labels = reportLabelsFor(languageForLocale(locale));

	const bullet = (text: string): string => `- ${redactText(text)}`;
	const timedBullet = (item: TimedText): string => {
		const prefix = item.time ? `**${item.time}** ` : "";
		return bullet(`${prefix}${item.text}`);
	};
	const emptyHint = () => `- ${labels.emptyHint}`;
	const renderSection = (title: string, lines: string[]): string =>
		[`## ${title}`, "", ...(lines.length > 0 ? lines : [emptyHint()]), ""].join("\n");

	const parts: string[] = [];
	parts.push(`# ${labels.reportTitle(report.date)}`);
	parts.push("");
	parts.push(`${labels.generatedAt}${labels.sep}${report.generatedAt}`);
	parts.push(`${labels.window}${labels.sep}${report.window.label}`);
	parts.push("");

	parts.push(
		renderSection(labels.overview, [
			bullet(labels.stats.projects(report.stats.projectCount)),
			bullet(labels.stats.sessions(report.stats.sessionCount)),
			bullet(labels.stats.entries(report.stats.entryCount)),
			bullet(labels.stats.files(report.stats.fileCount)),
			...(report.stats.scanErrorCount > 0 ? [bullet(labels.stats.scanWarnings(report.stats.scanErrorCount))] : []),
		]),
	);

	parts.push(
		renderSection(
			labels.activeProjects,
			report.projects.map((project) => bullet(labels.projectLine(project.projectName, project.cwd, project.sessionCount, project.entryCount))),
		),
	);

	parts.push(renderSection(labels.completed, report.completed.map(timedBullet)));
	parts.push(renderSection(labels.keyOutputs, report.assistantNotes.map(timedBullet)));

	const fileLines = report.files.slice(0, 40).map((file) => bullet(`\`${file}\``));
	if (report.files.length > 40) {
		fileLines.push(bullet(labels.moreFiles(report.files.length - 40)));
	}
	const toolLines = report.toolCounts.map((tool) => bullet(labels.toolCount(tool.name, tool.count)));
	parts.push(renderSection(labels.filesAndTools, [...toolLines, ...fileLines]));

	parts.push(renderSection(labels.risks, [...report.errors.map(timedBullet), ...report.blockers.map(timedBullet)]));
	parts.push(renderSection(labels.followUps, report.followUps.map(timedBullet)));

	if (report.scanErrors.length > 0) {
		parts.push(
			renderSection(
				labels.scanWarnings,
				report.scanErrors.slice(0, 10).map((error) => bullet(`${error.file}:${error.line} ${error.error}`)),
			),
		);
	}

	return `${parts.join("\n").trim()}\n`;
}
