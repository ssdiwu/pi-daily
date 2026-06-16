import path from "node:path";

import { truncateText } from "./redact.ts";
import type { MutableSessionActivity, ParsedSession, SessionActivity, SessionEntry, SessionMessage, TimeWindow, TimedText, ToolActivity } from "./types.ts";

const PATH_PATTERN = /(?:^|\s)(?:[./~\w-]*\/?[\w.-]+\.[A-Za-z0-9]{1,8}|[./~\w-]+\/[\w./-]+)/g;
const COMPLETION_PATTERN = /(已处理|已完成|已更新|已修复|已调整|已回复|已保存|已关闭|已恢复|已移除|已推送|已安装|已配置|已改好|已补好|搞定了|处理完了|完成了|done|fixed|updated|saved|replied|resolved|handled)/i;
const IN_PROGRESS_PATTERN = /(我先|我来|接下来|继续|先看|先检查|我会|准备|正在|稍后|let me|i will|i'll|continuing|checking|working on)/i;

type Timestamp = string | number | Date | null | undefined;

interface ContentTextItem {
	type?: string;
	text?: string;
}

interface ContentToolCallItem {
	type?: string;
	id?: string;
	name?: string;
	arguments?: Record<string, unknown>;
}

function getTimestamp(entry: SessionEntry): Timestamp {
	return entry?.timestamp || entry?.message?.timestamp || null;
}

function toDate(timestamp: Timestamp): Date | null {
	if (!timestamp) return null;
	const date = new Date(timestamp);
	return Number.isNaN(date.getTime()) ? null : date;
}

function getLocalDateString(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

export function createDefaultWindow(targetDate: string): TimeWindow {
	const [year, month, day] = targetDate.split("-").map(Number);
	const start = new Date(year, month - 1, day, 0, 0, 0, 0);
	const end = new Date(start);
	end.setDate(end.getDate() + 1);
	return { start, end, label: `${targetDate} 00:00 → ${getLocalDateString(end)} 00:00`, dayStart: "00:00" };
}

function formatTime(timestamp: Timestamp): string {
	const date = toDate(timestamp);
	if (!date) return "";
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isInsideWindow(timestamp: Timestamp, window: TimeWindow): boolean {
	const date = toDate(timestamp);
	return date ? date >= window.start && date < window.end : false;
}

function extractText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((item: ContentTextItem) => item?.type === "text" && typeof item.text === "string")
		.map((item: ContentTextItem) => item.text)
		.join("\n");
}

function extractToolCalls(content: unknown): ToolActivity[] {
	if (!Array.isArray(content)) return [];
	return content
		.filter((item: ContentToolCallItem) => item?.type === "toolCall")
		.map((item: ContentToolCallItem) => ({
			time: "",
			toolName: item.name || "",
			arguments: item.arguments || {},
		}));
}

function extractPathsFromText(text: unknown): string[] {
	const paths: string[] = [];
	for (const match of String(text).matchAll(PATH_PATTERN)) {
		const value = match[0].trim();
		if (value) paths.push(path.normalize(value));
	}
	return paths;
}

function getStringArg(args: Record<string, unknown>, key: string): string | undefined {
	const value = args[key];
	return typeof value === "string" ? value : undefined;
}

function getToolFilePaths(toolName: string, args: Record<string, unknown> = {}): string[] {
	if (["read", "write", "edit"].includes(toolName)) {
		return [getStringArg(args, "path"), getStringArg(args, "file"), getStringArg(args, "target"), getStringArg(args, "pathName")]
			.filter((value): value is string => typeof value === "string")
			.map(path.normalize);
	}
	if (toolName === "bash") {
		return extractPathsFromText(getStringArg(args, "command") || "");
	}
	return [];
}

function createActivity(session: ParsedSession, targetDate: string, window: TimeWindow): MutableSessionActivity {
	const header = session.header || {};
	const cwd = typeof header.cwd === "string" ? header.cwd : "";
	return {
		targetDate,
		window,
		sessionId: typeof header.id === "string" ? header.id : session.file || "",
		file: session.file,
		cwd,
		projectName: cwd ? path.basename(cwd) || cwd : "unknown",
		activeEntryCount: 0,
		activeTimes: [],
		taskNotes: [],
		pendingNotes: [],
		completedNotes: [],
		assistantNotes: [],
		toolCalls: [],
		filePaths: new Set<string>(),
		errors: [],
		blockers: [],
	};
}

function recordToolCall(activity: MutableSessionActivity, timestamp: Timestamp, toolCall: ToolActivity): void {
	const args = toolCall.arguments || {};
	activity.toolCalls.push({
		time: formatTime(timestamp),
		toolName: toolCall.toolName,
		arguments: args,
	});
	for (const filePath of getToolFilePaths(toolCall.toolName, args)) {
		activity.filePaths.add(filePath);
	}
}

function resolveLatestPending(activity: MutableSessionActivity): void {
	if (activity.pendingNotes.length > 0) {
		activity.pendingNotes.pop();
	}
}

function updateLatestPending(activity: MutableSessionActivity, note: TimedText): void {
	if (activity.pendingNotes.length > 0) {
		activity.pendingNotes[activity.pendingNotes.length - 1] = note;
	}
}

function isCompletionText(text: string): boolean {
	return COMPLETION_PATTERN.test(text) && !IN_PROGRESS_PATTERN.test(text);
}

function handleAssistant(activity: MutableSessionActivity, entry: SessionEntry, timestamp: Timestamp): void {
	const content = entry.message?.content;
	const text = extractText(content);
	const summary = truncateText(text, 220);
	if (summary) activity.assistantNotes.push({ time: formatTime(timestamp), text: summary });
	if (summary && isCompletionText(text)) {
		activity.completedNotes.push({ time: formatTime(timestamp), text: summary });
		resolveLatestPending(activity);
	} else if (summary && IN_PROGRESS_PATTERN.test(text) && activity.pendingNotes.length > 0) {
		updateLatestPending(activity, { time: formatTime(timestamp), text: summary });
	}
	for (const toolCall of extractToolCalls(content)) recordToolCall(activity, timestamp, toolCall);
	if (/\b(blocked|blocker|stuck|error|failed)\b/i.test(text)) {
		activity.blockers.push({ time: formatTime(timestamp), text: truncateText(text, 160) });
	}
}

function handleToolResult(activity: MutableSessionActivity, message: SessionMessage, timestamp: Timestamp): void {
	const text = extractText(message.content);
	const summary = truncateText(text, 160);
	const toolName = message.toolName || "";
	if (summary) {
		activity.toolCalls.push({
			time: formatTime(timestamp),
			toolName,
			result: summary,
			isError: Boolean(message.isError),
		});
	}
	if (message.isError) {
		activity.errors.push({ time: formatTime(timestamp), text: summary || "tool error" });
	}
	if (toolName === "bash" && typeof message.command === "string") {
		for (const filePath of extractPathsFromText(message.command)) {
			activity.filePaths.add(filePath);
		}
	}
	for (const filePath of extractPathsFromText(text)) {
		activity.filePaths.add(filePath);
	}
}

function handleBashExecution(activity: MutableSessionActivity, message: SessionMessage, timestamp: Timestamp): void {
	const command = typeof message.command === "string" ? message.command : "";
	activity.toolCalls.push({ time: formatTime(timestamp), toolName: "bash", result: truncateText(command, 160) });
	for (const filePath of extractPathsFromText(command)) activity.filePaths.add(filePath);
	if (message.exitCode && message.exitCode !== 0) {
		activity.errors.push({ time: formatTime(timestamp), text: `bash exited ${message.exitCode}: ${truncateText(command, 120)}` });
	}
}

function finalizeActivity(activity: MutableSessionActivity): SessionActivity {
	const activeTimes = activity.activeTimes;
	return {
		targetDate: activity.targetDate,
		window: activity.window,
		sessionId: activity.sessionId,
		file: activity.file,
		cwd: activity.cwd,
		projectName: activity.projectName,
		activeEntryCount: activity.activeEntryCount,
		firstActiveTime: activeTimes[0] || "",
		lastActiveTime: activeTimes[activeTimes.length - 1] || "",
		taskNotes: activity.taskNotes,
		pendingNotes: activity.pendingNotes,
		completedNotes: activity.completedNotes,
		assistantNotes: activity.assistantNotes,
		toolCalls: activity.toolCalls,
		filePaths: [...activity.filePaths].sort(),
		errors: activity.errors,
		blockers: activity.blockers,
	};
}

export function extractSessionActivity(session: ParsedSession, targetDate: string, window: TimeWindow = createDefaultWindow(targetDate)): SessionActivity {
	const activity = createActivity(session, targetDate, window);
	for (const entry of session.entries || []) {
		const timestamp = getTimestamp(entry);
		if (entry.type !== "message" || !isInsideWindow(timestamp, window)) continue;

		const message = entry.message || {};
		activity.activeEntryCount += 1;
		activity.activeTimes.push(formatTime(timestamp));
		if (message.role === "user") {
			const note = { time: formatTime(timestamp), text: truncateText(extractText(message.content), 180) };
			activity.taskNotes.push(note);
			if (note.text) activity.pendingNotes.push(note);
		}
		if (message.role === "assistant") handleAssistant(activity, entry, timestamp);
		if (message.role === "toolResult") handleToolResult(activity, message, timestamp);
		if (message.role === "bashExecution") handleBashExecution(activity, message, timestamp);
	}
	activity.taskNotes = activity.taskNotes.filter((note) => note.text);
	activity.pendingNotes = activity.pendingNotes.filter((note) => note.text);
	activity.completedNotes = activity.completedNotes.filter((note) => note.text);
	return finalizeActivity(activity);
}

export function filterSessionsByWindow(sessions: ParsedSession[], targetDate: string, window: TimeWindow): Array<{ session: ParsedSession; activity: SessionActivity }> {
	return (sessions || [])
		.map((session) => ({ session, activity: extractSessionActivity(session, targetDate, window) }))
		.filter(({ activity }) => activity.activeEntryCount > 0);
}

export function filterSessionsByDate(sessions: ParsedSession[], targetDate: string): Array<{ session: ParsedSession; activity: SessionActivity }> {
	return filterSessionsByWindow(sessions, targetDate, createDefaultWindow(targetDate));
}
