import assert from "node:assert/strict";
import test from "node:test";

import { extractSessionActivity } from '../src/session-extract.ts';

const session = {
	file: '/tmp/session.jsonl',
	header: { type: 'session', id: 's1', cwd: '/repo/pi-daily' },
	entries: [
		{ type: 'message', timestamp: '2026-06-12T09:00:00.000Z', message: { role: 'user', content: '实现日报 MVP' } },
		{ type: 'message', timestamp: '2026-06-12T09:01:00.000Z', message: { role: 'assistant', content: [{ type: 'text', text: '已完成日报骨架并开始实现' }, { type: 'toolCall', id: 't1', name: 'read', arguments: { path: 'src/README.md' } }] } },
		{ type: 'message', timestamp: '2026-06-12T09:02:00.000Z', message: { role: 'toolResult', toolName: 'read', content: [{ type: 'text', text: 'ok' }], isError: false } },
		{ type: 'message', timestamp: '2026-06-12T09:03:00.000Z', message: { role: 'bashExecution', command: 'node test.js', output: 'fail', exitCode: 2, cancelled: false, truncated: false } },
		{ type: 'message', timestamp: '2026-06-11T09:00:00.000Z', message: { role: 'user', content: '昨天' } },
	],
};

test('extractSessionActivity collects tasks, tools, files and errors', () => {
	const activity = extractSessionActivity(session, '2026-06-12');
	assert.equal(activity.activeEntryCount, 4);
	assert.equal(activity.taskNotes[0].text, '实现日报 MVP');
	assert.equal(activity.filePaths.includes('src/README.md'), true);
	assert.equal(activity.completedNotes.length, 1);
	assert.equal(activity.pendingNotes.length, 0);
	assert.equal(activity.errors.length, 1);
	assert.equal(activity.errors[0].text.includes('bash exited 2'), true);
});
