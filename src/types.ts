export type DailyProjectFilter = "all" | "current" | string;

export interface DailyOptions {
	date: string;
	save: boolean;
	project: DailyProjectFilter;
	window: TimeWindow;
	confirmation?: DailyConfirmation;
}

export interface DailyConfirmation {
	title: string;
	message: string;
}

export interface TimeWindow {
	start: Date;
	end: Date;
	label: string;
	dayStart?: string;
}

export interface TimedText {
	time: string;
	text: string;
}

export interface ScanError {
	file?: string;
	line: number;
	error: string;
}

export interface SessionHeader {
	id?: string;
	cwd?: string;
	[key: string]: unknown;
}

export interface SessionMessage {
	role?: string;
	content?: unknown;
	timestamp?: string | number | Date | null;
	toolName?: string;
	isError?: boolean;
	command?: string;
	exitCode?: number;
	[key: string]: unknown;
}

export interface SessionEntry {
	type?: string;
	timestamp?: string | number | Date | null;
	message?: SessionMessage;
	[key: string]: unknown;
}

export interface ParsedSession {
	file?: string;
	header: SessionHeader | null;
	entries: SessionEntry[];
	errors?: ScanError[];
}

export interface SessionFile extends ParsedSession {
	file: string;
}

export interface ToolActivity {
	time: string;
	toolName: string;
	arguments?: Record<string, unknown>;
	result?: string;
	isError?: boolean;
}

export interface SessionActivity {
	targetDate: string;
	window: TimeWindow;
	sessionId: string;
	file?: string;
	cwd: string;
	projectName: string;
	activeEntryCount: number;
	firstActiveTime: string;
	lastActiveTime: string;
	taskNotes: TimedText[];
	pendingNotes: TimedText[];
	completedNotes: TimedText[];
	assistantNotes: TimedText[];
	toolCalls: ToolActivity[];
	filePaths: string[];
	errors: TimedText[];
	blockers: TimedText[];
}

export interface MutableSessionActivity extends Omit<SessionActivity, "firstActiveTime" | "lastActiveTime" | "filePaths"> {
	activeTimes: string[];
	filePaths: Set<string>;
}

export interface ProjectSummary {
	cwd: string;
	projectName: string;
	isDefaultWorkspace: boolean;
	sessionCount: number;
	entryCount: number;
	files: string[];
	tasks: TimedText[];
	completed: TimedText[];
	outputs: TimedText[];
	risks: TimedText[];
	followUps: TimedText[];
	toolCounts: ToolCount[];
}

export interface ToolCount {
	name: string;
	count: number;
}

export interface ReportStats {
	sessionCount: number;
	projectCount: number;
	entryCount: number;
	fileCount: number;
	scanErrorCount: number;
}

export interface ReportModel {
	date: string;
	window: TimeWindow;
	generatedAt: string;
	projectFilter: DailyProjectFilter;
	currentCwd: string;
	stats: ReportStats;
	projects: ProjectSummary[];
	tasks: TimedText[];
	completed: TimedText[];
	assistantNotes: TimedText[];
	files: string[];
	toolCounts: ToolCount[];
	errors: TimedText[];
	blockers: TimedText[];
	followUps: TimedText[];
	scanErrors: ScanError[];
}

export interface BuildDailyRuntime {
	now?: Date;
	currentCwd?: string;
	sessionRoot?: string;
	ctx?: any;
	build?: string;
	options?: DailyOptions;
}

export interface BuildDailyResult {
	options: DailyOptions;
	report: ReportModel;
	markdown: string;
	source: string;
	model?: string;
	errors: string[];
}

export interface AISummaryResult {
	markdown: string;
	source: "ai" | "fallback";
	model?: string;
	errors: string[];
}
