import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthority } from '../server/server.mjs';
import { army } from '../server/game.mjs';
function fixture() {
	const a = createAuthority({
		timedSetup: false, now: () => 1000000,
		teacherKey: 'teacher', classCode: 'TEST'
	}), p = Array.from({
		length: 4
	}, (_, i) => a.call('join', {
		classCode: 'TEST', name: 'Student ' + i
	}));
	a.call('teacher/start', {}, 'teacher');
	for (const x of p)
		a.call('setup', {
			ranks: army()
		}, x.token);
	return {
		a, p, ids: a.call('teacher/state', {}, 'teacher').matches.map(m => m.id)
	};
}
test('spectator endpoint requires teacher authorization; never accepts a student or host claim', () => {
	const { a, p, ids } = fixture();
	assert.throws(() => a.call('teacher/spectate', {
		matchId: ids[0], isHost: true
	}, p[0].token), /Teacher/);
	assert.throws(() => a.call('teacher/spectate', {
		matchId: ids[0]
	}, ''), /Teacher/);
});
test('spectator choice stays fixed across turns and polls; explicit switch redacts the other army', () => {
	const { a, p, ids } = fixture();
	let s = a.call('teacher/spectate', {
		matchId: ids[0], reveal: true, side: 1, perspective: 'red'
	}, 'teacher');
	assert.equal(s.match.side, 0);
	assert.deepEqual(s.match.playerNames, p.slice(0, 2).map(x => a.call('state', {}, x.token).nickname));
	assert(s.match.board.filter(x => x?.side === 1).every(x => x.rank === '?'));
	a.call('move', {
		from: 61, to: 51, seq: 2, requestId: 'first'
	}, p[0].token);
	s = a.call('teacher/spectate', {
		matchId: ids[0]
	}, 'teacher');
	assert.equal(s.match.side, 0);
	assert.equal(s.match.turn, 1);
	s = a.call('teacher/spectate', {
		matchId: ids[0], perspective: 'blue'
	}, 'teacher');
	assert.equal(s.match.side, 1);
	assert.equal(s.perspectiveName, a.call('state', {}, p[1].token).nickname);
	assert(s.match.board.filter(x => x?.side === 0).every(x => x.rank === '?'));
	assert.equal(s.match.events.at(-1).moving, '?');
	a.call('teacher/state', {}, 'teacher');
	assert.equal(a.call('teacher/spectate', {
		matchId: ids[0]
	}, 'teacher').match.side, 1);
	assert.equal(a.call('teacher/spectate', {
		matchId: ids[1]
	}, 'teacher').match.side, -1);
	assert.equal(a.call('teacher/spectate', {
		matchId: ids[0]
	}, 'teacher').match.side, 1);
	assert.throws(() => a.call('teacher/spectate', {
		matchId: ids[0], perspective: 'all'
	}, 'teacher'));
	assert.throws(() => a.call('teacher/spectate', {
		matchId: ids[0], perspective: 'red'
	}, p[0].token));
});
test('teacher can switch matches without mutating state or contaminating student views', () => {
	const { a, p, ids } = fixture();
	const before = JSON.stringify([...a.matches]);
	for (const id of ids) {
		const s = a.call('teacher/spectate', {
			matchId: id
		}, 'teacher');
		assert.equal(s.match.id, id);
	}
	assert.equal(JSON.stringify([...a.matches]), before);
	const student = a.call('state', {}, p[1].token);
	assert(student.match.board.filter(x => x?.side === 0).every(x => x.rank === '?'));
	assert.throws(() => a.call('teacher/spectate', {
		matchId: 'missing'
	}, 'teacher'), /not found/);
});
test('spectating paused/ended matches is read-only and cannot resume or move', () => {
	const { a, p, ids } = fixture();
	for (const phase of ['pause', 'end']) {
		a.call('teacher/' + phase, {}, 'teacher');
		const before = JSON.stringify([...a.matches]);
		const s = a.call('teacher/spectate', {
			matchId: ids[0], phase: 'active', from: 61, to: 51
		}, 'teacher');
		assert.equal(s.phase, phase === 'pause' ? 'paused' : 'ended');
		assert.equal(JSON.stringify([...a.matches]), before);
		assert.throws(() => a.call('move', {
			from: 61, to: 51, seq: 2, requestId: phase
		}, p[0].token), /teacher/);
	}
});
