import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDailyReport } from '../src/daily.ts';

const sessions = [
	{
		file: '/tmp/session.jsonl',
		header: { type: 'session', id: 's1', cwd: '/repo/pi-daily' },
		entries: [
			{ type: 'message', timestamp: '2026-06-12T09:00:00.000Z', message: { role: 'user', content: '实现日报 MVP' } },
		],
	},
];

test('buildDailyReport can use injected session root data', async () => {
	const { report } = await buildDailyReport('2026-06-12', { currentCwd: '/repo/pi-daily', sessionRoot: '/does/not/matter' });
	assert.equal(report.date, '2026-06-12');
	assert.equal(typeof report.generatedAt, 'string');
});
