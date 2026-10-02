import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAuthority } from '../server/server.mjs';
test('spectator toggle uses returned side and a single busy-guarded absolute perspective request', () => {
	const source = readFileSync('Assets/Scripts/HistoryGame.cs', 'utf8').split('void DrawSpectator()')[1].split('void DrawStudent()')[0];
	assert(source.includes('int targetSide = m.side == 0 ? 1 : 0;'));
	assert(source.includes('previousEnabled && !busy && (m.side == 0 || m.side == 1)'));
	assert.equal((source.match(/Send\("teacher\/spectate"/g) || []).length, 1);
	assert(source.includes('"Switch to " + SideName(m, targetSide)'));
	assert(source.includes('perspective = targetSide == 0 ? "red" : "blue"'));
	assert(!source.includes('"ack"'));
});
test('opposite-view requests persist on polls and leave match and acknowledgment state unchanged', () => {
	const a = createAuthority({
		teacherKey: 'test-teacher', classCode: 'TEST', now: () => 1000, timedSetup: false, timedTurns: false
	});
	a.call('join', {
		classCode: 'TEST'
	});
	a.call('join', {
		classCode: 'TEST'
	});
	a.call('teacher/start', {}, 'test-teacher');
	const m = [...a.matches.values()][0], before = JSON.stringify(m);
	let view = a.call('teacher/spectate', {
		matchId: m.id
	}, 'test-teacher');
	for (let i = 0; i < 4; i++) {
		const side = 1 - view.match.side;
		view = a.call('teacher/spectate', {
			matchId: m.id, perspective: side === 0 ? 'red' : 'blue'
		}, 'test-teacher');
		assert.equal(view.match.side, side);
		assert.equal(a.call('teacher/spectate', {
			matchId: m.id
		}, 'test-teacher').match.side, side);
		assert.equal(JSON.stringify(m), before);
	}
});
