import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, select, destinations, move, acknowledge, releaseReveal, view } from '../server/game.mjs';
import { createAuthority } from '../server/server.mjs';
const p = (side, rank, id = side + rank) => ({
	side, rank, id
});
function match() {
	const m = createMatch(['a', 'b']);
	m.phase = 'play';
	m.board[60] = p(0, '2');
	m.board[30] = p(1, '5');
	m.board[0] = p(1, '2', 'spare');
	m.board[99] = p(0, '4', 'spare0');
	return m;
}
test('authoritative targets include complete scout rays, attack distinction, lakes and repetition', () => {
	const m = match();
	select(m, 0, 60, 0);
	assert.deepEqual(m.selection.targets, destinations(m, 0, 60));
	assert(m.selection.targets.some(t => t.to === 30 && t.attack));
	assert(!m.selection.targets.some(t => t.to === 20));
	assert(m.selection.targets.some(t => t.to === 69 && !t.attack));
	m.board[62] = p(0, '2', 'lakeScout');
	assert(!destinations(m, 0, 62).some(t => t.to === 52));
	m.board[60] = p(0, '4', 'repeat');
	m.history[0] = [{
		id: 'repeat', from: 60, to: 50
	}, {
		id: 'repeat', from: 50, to: 60
	}];
	assert(!destinations(m, 0, 60).some(t => t.to === 50));
	for (const r of ['B', 'F']) {
		m.board[60] = p(0, r);
		assert.throws(() => select(m, 0, 60, 0));
		assert.equal(destinations(m, 0, 60).length, 0);
	}
});
test('selection cannot expose enemy ranks and is private from inactive opponent', () => {
	const m = match();
	select(m, 0, 60, 0);
	assert.equal(view(m, 1).selection, null);
	assert.equal(view(m, 0).board[30].rank, '?');
	assert.throws(() => select(m, 1, 30, 0));
	assert.throws(() => select(m, 0, 30, 0));
	assert.throws(() => select(m, 0, 60, 1));
});
test('combat delivered to both players, losing attacker, reconnect, ordered and duplicate acknowledgment', () => {
	const m = match();
	move(m, 0, 60, 30, 0, 'combat');
	assert.equal(m.reveal.outcome, -1);
	for (const side of [0, 1]) {
		const b = view(m, side).battle;
		assert.equal(b.attacker, '2');
		assert.equal(b.defender, '5');
		assert.equal(b.seq, 1);
	}
	assert.throws(() => move(m, 1, 0, 10, 1, 'too-soon'));
	acknowledge(m, 0, 1);
	acknowledge(m, 0, 1);
	assert(m.reveal);
	assert.equal(view(m, 1).battle.seq, 1);
	acknowledge(m, 1, 1);
	assert.equal(m.reveal, null);
	assert.equal(view(m, 0).battle, null);
	move(m, 1, 0, 10, 1, 'next');
});
test('teacher release keeps absent player reveal; stale recovery and out-of-order ack rejected', () => {
	const m = match();
	move(m, 0, 60, 30, 0, 'combat');
	acknowledge(m, 0, 1);
	releaseReveal(m, 1, 1);
	assert.equal(m.reveal, null);
	assert.equal(view(m, 1).battle.seq, 1);
	assert.throws(() => move(m, 1, 0, 10, 1, 'unread'));
	assert.throws(() => releaseReveal(m, 1, 1));
	m.events.push({
		kind: 'combat', seq: 2, ack: [false, false], released: [false, false]
	});
	assert.throws(() => acknowledge(m, 1, 2));
	acknowledge(m, 1, 1);
	acknowledge(m, 1, 2);
	assert.equal(m.recovery.length, 1);
});
test('all special combat outcomes retain exact reveals including final flag and equal ranks', () => {
	for (const [a, d, outcome] of [['3', 'B', 1], ['10', 'B', -1], ['1', '10', 1], ['10', '1', 1], ['4', '4', 0], ['2', 'F', 1]]) {
		const m = match();
		m.board[60] = p(0, a);
		m.board[50] = p(1, d);
		move(m, 0, 60, 50, 0, 'special');
		assert.equal(m.reveal.outcome, outcome);
		assert.equal(m.reveal.attacker, a);
		assert.equal(m.reveal.defender, d);
		acknowledge(m, 0, 1);
		acknowledge(m, 1, 1);
		assert.equal(m.reveal, null);
	}
});
test('teacher-only recovery and spectator selection/battle do not mutate or grant student authority', () => {
	const a = createAuthority({
		timedSetup: false,
		classCode: 'C', teacherKey: 'teacher'
	}), x = a.call('join', {
		classCode: 'C', name: 'A'
	}), y = a.call('join', {
		classCode: 'C', name: 'B'
	});
	a.call('teacher/start', {}, 'teacher');
	const m = [...a.matches.values()][0], fixture = match();
	Object.assign(m, {
		board: fixture.board, phase: 'play'
	});
	a.call('select', {
		from: 60, seq: 0
	}, x.token);
	assert.equal(a.call('teacher/spectate', {
		matchId: m.id
	}, 'teacher').match.selection.from, 60);
	a.call('move', {
		from: 60, to: 30, seq: 0, requestId: 'attack'
	}, x.token);
	assert.equal(a.call('teacher/spectate', {
		matchId: m.id
	}, 'teacher').match.side, 0);
	assert.throws(() => a.call('teacher/release-reveal', {
		matchId: m.id, seq: 1, side: 1
	}, x.token));
	a.call('teacher/pause', {}, 'teacher');
	a.call('ack', {
		seq: 1
	}, x.token);
	a.call('teacher/release-reveal', {
		matchId: m.id, seq: 1, side: 1
	}, 'teacher');
	assert.equal(a.call('state', {}, y.token).match.battle.seq, 1);
	assert.throws(() => a.call('move', {
		from: 0, to: 10, seq: 1, requestId: 'paused'
	}, y.token));
	a.call('ack', {
		seq: 1
	}, y.token);
	assert.equal(a.call('teacher/state', {}, 'teacher').phase, 'paused');
});
test('ending and starting another round retains unread combat and rejects foreign archived acknowledgments', () => {
	const a = createAuthority({
		timedSetup: false,
		classCode: 'C', teacherKey: 'teacher'
	}), x = a.call('join', {
		classCode: 'C', name: 'A'
	}), y = a.call('join', {
		classCode: 'C', name: 'B'
	}), z = a.call('join', {
		classCode: 'C', name: 'C'
	});
	a.call('teacher/start', {}, 'teacher');
	const m = [...a.matches.values()][0];
	Object.assign(m, {
		board: match().board, phase: 'play'
	});
	a.call('move', {
		from: 60, to: 30, seq: 0, requestId: 'hit'
	}, x.token);
	a.call('teacher/end', {}, 'teacher');
	a.call('teacher/start', {}, 'teacher');
	assert.equal(a.call('state', {}, y.token).match.id, m.id);
	assert.equal(a.call('state', {}, y.token).match.battle.attacker, '2');
	assert.throws(() => a.call('ack', {
		matchId: m.id, seq: 1
	}, z.token));
	a.call('ack', {
		matchId: m.id, seq: 1
	}, y.token);
	assert.notEqual(a.call('state', {}, y.token).match.id, m.id);
	assert.equal(a.call('state', {}, x.token).match.id, m.id);
});
test('manual blue perspective survives combat and acknowledgments without exposing other moving ranks', () => {
	const a = createAuthority({
		timedSetup: false,
		classCode: 'C', teacherKey: 'teacher'
	}), x = a.call('join', {
		classCode: 'C', name: 'Same nickname'
	}), y = a.call('join', {
		classCode: 'C', name: 'Same nickname'
	});
	a.call('teacher/start', {}, 'teacher');
	const m = [...a.matches.values()][0];
	Object.assign(m, {
		board: match().board, phase: 'play'
	});
	a.call('teacher/spectate', {
		matchId: m.id, perspective: 'blue'
	}, 'teacher');
	a.call('select', {
		from: 60, seq: 0
	}, x.token);
	let s = a.call('teacher/spectate', {
		matchId: m.id
	}, 'teacher');
	assert.equal(s.match.side, 1);
	assert.equal(s.match.selection.from, 60);
	assert.equal(s.match.board[60].rank, '?');
	a.call('move', {
		from: 60, to: 30, seq: 0, requestId: 'battle'
	}, x.token);
	s = a.call('teacher/spectate', {
		matchId: m.id
	}, 'teacher');
	assert.equal(s.match.side, 1);
	assert.equal(s.match.battle.attacker, '2');
	assert.deepEqual(s.match.playerNames, [x, y].map(p => a.call('state', {}, p.token).nickname));
	assert.notEqual(s.match.playerNames[0], s.match.playerNames[1]);
	a.call('ack', {
		seq: 1
	}, x.token);
	a.call('ack', {
		seq: 1
	}, y.token);
	assert.equal(a.call('teacher/spectate', {
		matchId: m.id
	}, 'teacher').match.side, 1);
});
test('one-time in-memory restore preserves participant tokens, pending reveal, history and perspective', () => {
	const a = createAuthority({
		timedSetup: false,
		classCode: 'C', teacherKey: 'teacher'
	}), x = a.call('join', {
		classCode: 'C', name: 'A'
	}), y = a.call('join', {
		classCode: 'C', name: 'B'
	});
	a.call('teacher/start', {}, 'teacher');
	const m = [...a.matches.values()][0];
	Object.assign(m, {
		board: match().board, phase: 'play'
	});
	a.call('move', {
		from: 60, to: 30, seq: 0, requestId: 'held'
	}, x.token);
	const snapshot = {
		presence: x.presence, phase: 'paused', order: [x.player, y.player], students: [{
			id: x.player, name: 'A', token: x.token
		}, {
			id: y.player, name: 'B', token: y.token
		}], matches: [{
			...m, requests: [...m.requests]
		}], archives: [], perspectives: [[m.id, 1]]
	};
	const restored = createAuthority({
		timedSetup: false,
		classCode: 'C', teacherKey: 'teacher', snapshot: JSON.parse(JSON.stringify(snapshot))
	});
	const s = restored.call('state', {}, x.token);
	assert.equal(s.phase, 'paused');
	assert.equal(s.player, x.player);
	assert.equal(s.match.id, m.id);
	assert.equal(s.match.seq, 1);
	assert.equal(s.match.battle.attacker, '2');
	assert.equal(restored.call('teacher/spectate', {
		matchId: m.id
	}, 'teacher').match.side, 1);
	restored.call('ack', {
		seq: 1
	}, x.token);
	restored.call('ack', {
		seq: 1
	}, y.token);
	assert.equal(restored.call('state', {}, y.token).match.battle, null);
	assert.deepEqual(restored.matches.get(m.id).history, m.history);
});
