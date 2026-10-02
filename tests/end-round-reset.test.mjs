import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthority } from '../browser/engine/authority.mjs';
import { army } from '../server/game.mjs';
test('End round clears live matches and pairs but keeps connected identities and archived games', () => {
	const a = createAuthority({
		teacherKey: 't', classCode: 'KEEP', now: () => 100000, timedSetup: false, timedTurns: false
	});
	const p = Array.from({
		length: 4
	}, () => a.call('join', {
		classCode: 'KEEP'
	}));
	a.call('teacher/start', {}, 't');
	for (const x of p)
		a.call('setup', {
			ranks: army()
		}, x.token);
	const old = [...a.matches.values()], ids = old.map(m => m.id);
	a.call('teacher/pause', {}, 't');
	assert.equal(a.matches.size, 2);
	assert.equal(a.call('state', {}, p[0].token).paired, true);
	a.call('teacher/resume', {}, 't');
	const ended = a.call('teacher/end', {}, 't');
	assert.equal(ended.phase, 'ended');
	assert.equal(ended.matches.length, 0);
	assert.equal(a.matches.size, 0);
	assert(ended.roster.every(p => p.pair === 0 && p.waiting && p.connected));
	for (const player of p) {
		const v = a.call('state', {}, player.token);
		assert.equal(v.match, null);
		assert.equal(v.paired, false);
		assert.equal(v.classCode, 'KEEP');
	}
	assert.equal(a.exportSnapshot().archives.length, 2);
	assert(a.exportSnapshot().archives.every(m => m.roundEnded));
	assert.equal(a.call('teacher/spectate', {
		matchId: ids[0]
	}, 't').roundEnded, true);
	assert.throws(() => a.call('teacher/resume', {}, 't'));
	a.call('teacher/randomize', {}, 't');
	assert(a.call('teacher/state', {}, 't').roster.every(p => p.pair > 0));
	a.call('teacher/start', {}, 't');
	assert.equal(a.matches.size, 2);
	assert([...a.matches.keys()].every(id => !ids.includes(id)));
	assert.deepEqual([...a.students.keys()], p.map(x => x.player));
});
test('End round cannot revive an old unacknowledged reveal on the next round', () => {
	const a = createAuthority({
		teacherKey: 't', classCode: 'KEEP', now: () => 100000, timedSetup: false, timedTurns: false
	});
	const p = [a.call('join', {
		classCode: 'KEEP'
	}), a.call('join', {
		classCode: 'KEEP'
	})];
	a.call('teacher/start', {}, 't');
	const m = [...a.matches.values()][0];
	m.events.push({
		kind: 'combat', seq: 1, side: 0, ack: [false, false]
	});
	a.call('teacher/end', {}, 't');
	assert.equal(a.call('state', {}, p[0].token).match, null);
	a.call('teacher/start', {}, 't');
	assert.notEqual(a.call('state', {}, p[0].token).match.id, m.id);
});
