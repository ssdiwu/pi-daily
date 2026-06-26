import os from "node:os";
import path from "node:path";

import { scanSessions } from "./session-scan.ts";
import { createDefaultWindow, filterSessionsByWindow } from "./session-extract.ts";
import { formatLocalTimestamp } from "./time-window.ts";
import type { DailyProjectFilter, ParsedSession, ProjectSummary, ReportModel, ScanError, SessionActivity, TimeWindow, TimedText, ToolCount } from "./types.ts";

export interface BuildReportModelInput {
	date: string;
	window?: TimeWindow;
	sessions: ParsedSession[];
	scanErrors?: ScanError[];
	projectFilter?: DailyProjectFilter;
	currentCwd?: string;
	now?: Date;
}

export interface GenerateDailyReportOptions {
	date: string;
	window?: TimeWindow;
	project?: DailyProjectFilter;
	currentCwd?: string;
	sessionRoot?: string;
	now?: Date;
}

function uniqueByText<T extends TimedText | string>(items: T[], limit = 12): T[] {
	const seen = new Set<string>();
	const result: T[] = [];
	for (const item of items) {
		const key = typeof item === "string" ? item : item.text;
		if (!key || seen.has(key)) continue;
		seen.add(key);
		result.push(item);
		if (result.length >= limit) break;
	}
	return result;
}

interface ProjectAccumulator {
	cwd: string;
	projectName: string;
	isDefaultWorkspace: boolean;
	sessionCount: number;
	entryCount: number;
	files: Set<string>;
	tasks: TimedText[];
	completed: TimedText[];
	outputs: TimedText[];
	risks: TimedText[];
	followUps: TimedText[];
	toolCounts: Map<string, number>;
}

function buildProjectAccumulators(activities: SessionActivity[]): ProjectAccumulator[] {
	const byCwd = new Map<string, ProjectAccumulator>();
	for (const activity of activities) {
		const key = activity.cwd || activity.projectName;
		const existing = byCwd.get(key) || {
			cwd: activity.cwd,
			projectName: activity.projectName,
			isDefaultWorkspace: activity.cwd === os.homedir(),
			sessionCount: 0,
			entryCount: 0,
			files: new Set<string>(),
			tasks: [],
			completed: [],
			outputs: [],
			risks: [],
			followUps: [],
			toolCounts: new Map<string, number>(),
		};
		existing.sessionCount += 1;
		existing.entryCount += activity.activeEntryCount;
		for (const file of activity.filePaths) existing.files.add(file);
		existing.tasks.push(...activity.taskNotes);
		existing.completed.push(...activity.completedNotes);
		existing.outputs.push(...activity.assistantNotes);
		existing.risks.push(...activity.errors, ...activity.blockers);
		existing.followUps.push(...activity.pendingNotes);
		for (const call of activity.toolCalls) {
			if (!call.toolName) continue;
			existing.toolCounts.set(call.toolName, (existing.toolCounts.get(call.toolName) || 0) + 1);
		}
		byCwd.set(key, existing);
	}
	return [...byCwd.values()].sort((a, b) => b.entryCount - a.entryCount);
}

function buildProjects(activities: SessionActivity[]): ProjectSummary[] {
	return buildProjectAccumulators(activities).map((project) => ({
		cwd: project.cwd,
		projectName: project.projectName,
		isDefaultWorkspace: project.isDefaultWorkspace,
		sessionCount: project.sessionCount,
		entryCount: project.entryCount,
		files: [...project.files].sort().slice(0, 20),
		tasks: uniqueByText(project.tasks, 8),
		completed: uniqueByText(project.completed, 8),
		outputs: uniqueByText(project.outputs, 8),
		risks: uniqueByText(project.risks, 8),
		followUps: uniqueByText(project.followUps, 8),
		toolCounts: [...project.toolCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]): ToolCount => ({ name, count })),
	}));
}

export function buildReportModel({ date, window = createDefaultWindow(date), sessions, scanErrors = [], projectFilter = "all", currentCwd = "", now = new Date() }: BuildReportModelInput): ReportModel {
	let sessionActivities = filterSessionsByWindow(sessions, date, window).map(({ activity }) => activity);
	if (projectFilter === "current" && currentCwd) {
		sessionActivities = sessionActivities.filter((activity) => path.resolve(activity.cwd || ".") === path.resolve(currentCwd));
	}

	const tasks = uniqueByText(sessionActivities.flatMap((activity) => activity.taskNotes), 24);
	const completed = uniqueByText(sessionActivities.flatMap((activity) => activity.completedNotes), 16);
	const assistantNotes = uniqueByText(sessionActivities.flatMap((activity) => activity.assistantNotes), 12);
	const errors = uniqueByText(sessionActivities.flatMap((activity) => activity.errors), 12);
	const blockers = uniqueByText(sessionActivities.flatMap((activity) => activity.blockers), 12);
	const followUps = uniqueByText([...sessionActivities.flatMap((activity) => activity.pendingNotes), ...errors, ...blockers], 16);
	const files = [...new Set(sessionActivities.flatMap((activity) => activity.filePaths))].sort();
	const toolCounts = new Map<string, number>();

	for (const call of sessionActivities.flatMap((activity) => activity.toolCalls)) {
		if (!call.toolName) continue;
		toolCounts.set(call.toolName, (toolCounts.get(call.toolName) || 0) + 1);
	}

	return {
		date,
		window,
		generatedAt: formatLocalTimestamp(now),
		projectFilter,
		currentCwd,
		stats: {
			sessionCount: sessionActivities.length,
			projectCount: new Set(sessionActivities.map((activity) => activity.cwd || activity.projectName)).size,
			entryCount: sessionActivities.reduce((sum, activity) => sum + activity.activeEntryCount, 0),
			fileCount: files.length,
			scanErrorCount: scanErrors.length,
		},
		projects: buildProjects(sessionActivities),
		tasks,
		completed,
		assistantNotes,
		files,
		toolCounts: [...toolCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]): ToolCount => ({ name, count })),
		errors,
		blockers,
		followUps,
		scanErrors,
	};
}

export function getDefaultReportPath(date: string, homeDir = os.homedir()): string {
	return path.join(homeDir, "Documents", "pi-daily-reports", `${date}.md`);
}

export async function generateDailyReportModel(options: GenerateDailyReportOptions): Promise<ReportModel> {
	const scanResult = await scanSessions({ sessionRoot: options.sessionRoot });
	return buildReportModel({
		date: options.date,
		window: options.window,
		sessions: scanResult.sessions,
		scanErrors: scanResult.errors,
		projectFilter: options.project || "all",
		currentCwd: options.currentCwd || "",
		now: options.now,
	});
}
