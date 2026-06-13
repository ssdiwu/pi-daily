import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ParsedSession, ScanError, SessionEntry, SessionFile, SessionHeader } from "./types.ts";

export interface ScanSessionsOptions {
	sessionRoot?: string;
	files?: string[];
}

export interface ScanSessionsResult {
	sessionRoot: string;
	files: string[];
	sessions: SessionFile[];
	errors: ScanError[];
}

export function getDefaultSessionRoot(homeDir = os.homedir()): string {
	return path.join(homeDir, ".pi", "agent", "sessions");
}

async function pathExists(targetPath: string): Promise<boolean> {
	try {
		await fs.access(targetPath);
		return true;
	} catch {
		return false;
	}
}

async function collectJsonlFiles(directory: string, files: string[] = []): Promise<string[]> {
	let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }> = [];
	try {
		entries = (await fs.readdir(directory, { withFileTypes: true })) as Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
	} catch {
		return files;
	}

	for (const entry of entries) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			await collectJsonlFiles(entryPath, files);
			continue;
		}
		if (entry.isFile() && entry.name.endsWith(".jsonl")) {
			files.push(entryPath);
		}
	}
	return files;
}

export async function findSessionFiles(sessionRoot = getDefaultSessionRoot()): Promise<string[]> {
	if (!(await pathExists(sessionRoot))) {
		return [];
	}
	const files = await collectJsonlFiles(sessionRoot);
	return files.sort();
}

function toSessionEntry(value: unknown): SessionEntry {
	return value && typeof value === "object" ? (value as SessionEntry) : {};
}

export function parseSessionJsonl(content: string): ParsedSession {
	const entries: SessionEntry[] = [];
	const errors: ScanError[] = [];
	const lines = String(content).split(/\r?\n/);

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index].trim();
		if (!line) {
			continue;
		}
		try {
			entries.push(toSessionEntry(JSON.parse(line)));
		} catch (error) {
			errors.push({ line: index + 1, error: error instanceof Error ? error.message : String(error) });
		}
	}

	const headerEntry = entries.find((entry) => entry?.type === "session") || null;
	const header = headerEntry ? (headerEntry as SessionHeader) : null;
	return { header, entries, errors };
}

export async function readSessionFile(file: string): Promise<SessionFile> {
	const content = await fs.readFile(file, "utf8");
	const parsed = parseSessionJsonl(content);
	return { file, ...parsed };
}

export async function scanSessions(options: ScanSessionsOptions = {}): Promise<ScanSessionsResult> {
	const sessionRoot = options.sessionRoot || getDefaultSessionRoot();
	const files = options.files || (await findSessionFiles(sessionRoot));
	const sessions: SessionFile[] = [];
	const errors: ScanError[] = [];

	for (const file of files) {
		try {
			const session = await readSessionFile(file);
			sessions.push(session);
			for (const parseError of session.errors || []) {
				errors.push({ file, ...parseError });
			}
		} catch (error) {
			errors.push({ file, line: 0, error: error instanceof Error ? error.message : String(error) });
		}
	}

	return { sessionRoot, files, sessions, errors };
}
