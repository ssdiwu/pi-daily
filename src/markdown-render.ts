import { redactText } from "./redact.ts";
import type { ReportModel, TimedText } from "./types.ts";

function bullet(text: string): string {
	return `- ${redactText(text)}`;
}

function timedBullet(item: TimedText): string {
	const prefix = item.time ? `**${item.time}** ` : "";
	return bullet(`${prefix}${item.text}`);
}

function emptyHint(text = "暂无记录"): string {
	return `- ${text}`;
}

function renderSection(title: string, lines: string[]): string {
	return [`## ${title}`, "", ...(lines.length > 0 ? lines : [emptyHint()]), ""].join("\n");
}

export function renderMarkdownReport(report: ReportModel): string {
	const parts: string[] = [];
	parts.push(`# ${report.date} 工作日报`);
	parts.push("");
	parts.push(`生成时间：${report.generatedAt}`);
	parts.push("");

	parts.push(
		renderSection("今日概览", [
			bullet(`活跃项目：${report.stats.projectCount} 个`),
			bullet(`活跃会话：${report.stats.sessionCount} 个`),
			bullet(`活动条目：${report.stats.entryCount} 条`),
			bullet(`涉及文件：${report.stats.fileCount} 个`),
			...(report.stats.scanErrorCount > 0 ? [bullet(`解析警告：${report.stats.scanErrorCount} 条`)] : []),
		]),
	);

	parts.push(
		renderSection(
			"活跃项目",
			report.projects.map((project) => {
				const cwd = project.cwd ? `（${project.cwd}）` : "";
				return bullet(`${project.projectName}${cwd}：${project.sessionCount} 个 session，${project.entryCount} 条活动`);
			}),
		),
	);

	parts.push(renderSection("完成事项", report.completed.map(timedBullet)));
	parts.push(renderSection("关键产出", report.assistantNotes.map(timedBullet)));

	const fileLines = report.files.slice(0, 40).map((file) => bullet(`\`${file}\``));
	if (report.files.length > 40) {
		fileLines.push(bullet(`另有 ${report.files.length - 40} 个文件未展示`));
	}
	const toolLines = report.toolCounts.map((tool) => bullet(`${tool.name}：${tool.count} 次`));
	parts.push(renderSection("文件与工具活动", [...toolLines, ...fileLines]));

	parts.push(renderSection("阻塞 / 风险", [...report.errors.map(timedBullet), ...report.blockers.map(timedBullet)]));
	parts.push(renderSection("待跟进", report.followUps.map(timedBullet)));

	if (report.scanErrors.length > 0) {
		parts.push(
			renderSection(
				"解析警告",
				report.scanErrors.slice(0, 10).map((error) => bullet(`${error.file}:${error.line} ${error.error}`)),
			),
		);
	}

	return `${parts.join("\n").trim()}\n`;
}
