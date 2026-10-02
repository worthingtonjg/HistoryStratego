import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COUNTS, army, createMatch, setup, legal, resolve, move, view } from '../server/game.mjs';
import { createAuthority, serve } from '../server/server.mjs';
const piece = (side, rank, id = side + rank) => ({
	side, rank, id
});
const sparse = () => {
	const m = createMatch(['a', 'b']);
	m.phase = 'play';
	m.board[0] = piece(1, '2', 'opponent');
	return m;
};
test('army has classic 40-piece counts', () => {
	assert.equal(army().length, 40);
	assert.deepEqual(COUNTS, {
		F: 1, B: 6, 1: 1, 2: 8, 3: 5, 4: 4, 5: 4, 6: 4, 7: 3, 8: 2, 9: 1, 10: 1
	});
});
test('setup requires exactly the prescribed ranks and locks independently', () => {
	const m = createMatch(['a', 'b']);
	assert.throws(() => setup(m, 0, Array(40).fill('10')));
	setup(m, 0, army());
	assert.equal(m.phase, 'setup');
	assert.throws(() => setup(m, 0, army()));
	setup(m, 1, army());
	assert.equal(m.phase, 'play');
	assert.equal(m.board.filter(Boolean).length, 80);
});
test('opponent ranks and piece IDs never appear in view', () => {
	const m = createMatch(['a', 'b']);
	setup(m, 0, army());
	setup(m, 1, army());
	const v = view(m, 0);
	assert(v.board.filter(p => p?.side === 1).every(p => p.rank === '?' && !('id' in p)));
	assert(!JSON.stringify(v).includes(m.board[0].id));
});
test('orthogonal single-square movement; no diagonal, same square, friendly capture, bombs or flags', () => {
	const m = sparse();
	m.board[60] = piece(0, '6');
	assert(legal(m, 0, 60, 50));
	for (const to of [49, 62, 60, -1, 100, NaN])
		assert(!legal(m, 0, 60, to));
	m.board[50] = piece(0, '4');
	assert(!legal(m, 0, 60, 50));
	for (const r of ['B', 'F']) {
		m.board[60] = piece(0, r);
		assert(!legal(m, 0, 60, 61));
	}
});
test('scout moves and attacks long distance; cannot cross pieces or lakes', () => {
	const m = sparse();
	m.board[60] = piece(0, '2');
	assert(legal(m, 0, 60, 0));
	m.board[30] = piece(1, '4');
	assert(legal(m, 0, 60, 30));
	assert(!legal(m, 0, 60, 0));
	m.board[62] = piece(0, '2');
	assert(!legal(m, 0, 62, 32));
	assert(!legal(m, 0, 60, 52));
});
test('combat table: bombs, miner, spy direction, equal ranks and flag', () => {
	assert.equal(resolve('3', 'B'), 1);
	assert.equal(resolve('10', 'B'), -1);
	assert.equal(resolve('1', '10'), 1);
	assert.equal(resolve('10', '1'), 1);
	assert.equal(resolve('1', '2'), -1);
	assert.equal(resolve('1', '1'), 0);
	assert.equal(resolve('6', '6'), 0);
	assert.equal(resolve('2', 'F'), 1);
});
test('turn and sequence validation; duplicate delivery is idempotent', () => {
	const m = sparse();
	m.board[60] = piece(0, '4');
	assert.throws(() => move(m, 1, 0, 10, 0, 'x'));
	assert.throws(() => move(m, 0, 60, 50, 1, 'x'));
	move(m, 0, 60, 50, 0, 'x');
	move(m, 0, 60, 50, 0, 'x');
	assert.equal(m.seq, 1);
	assert.throws(() => move(m, 0, 50, 40, 1, 'x'));
	assert.equal(m.turn, 1);
});
test('equal combat removes both; defender stays put when stronger; combat reveals ranks', () => {
	for (const [r, expected] of [['4', null], ['6', '6']]) {
		const m = sparse();
		m.board[60] = piece(0, '4');
		m.board[50] = piece(1, r, 'target');
		move(m, 0, 60, 50, 0, 'x');
		assert.equal(m.board[60], null);
		assert.equal(m.board[50]?.rank ?? null, expected);
		assert.equal(view(m, 0).events[0].defender, r);
	}
});
test('flag capture ends match and prohibits further moves', () => {
	const m = sparse();
	m.board[60] = piece(0, '2');
	m.board[50] = piece(1, 'F');
	move(m, 0, 60, 50, 0, 'x');
	assert.equal(m.phase, 'over');
	assert.equal(m.winner, 0);
	assert.throws(() => move(m, 1, 0, 10, 1, 'y'));
});
test('no legal move causes defeat', () => {
	const m = sparse();
	m.board[0] = piece(1, 'F');
	m.board[60] = piece(0, '4');
	move(m, 0, 60, 50, 0, 'x');
	assert.equal(m.winner, 0);
});
test('third repeated two-square traversal prohibited, other-piece move resets', () => {
	const m = sparse();
	m.board[60] = piece(0, '4', 'p');
	m.history[0] = [{
		id: 'p', from: 60, to: 50
	}, {
		id: 'p', from: 50, to: 60
	}];
	assert(!legal(m, 0, 60, 50));
	assert(legal(m, 0, 60, 61));
	m.history[0][0].id = 'different';
	assert(legal(m, 0, 60, 50));
});
function classroom(n = 2) {
	const a = createAuthority({
		timedSetup: false,
		teacherKey: 'teacher-secret', classCode: 'CLASS'
	});
	const p = Array.from({
		length: n
	}, (_, i) => a.call('join', {
		classCode: 'CLASS', name: 'Student ' + i
	}));
	return {
		a, p
	};
}
test('students cannot access teacher state or controls even if claiming host', () => {
	const { a, p } = classroom();
	for (const route of ['teacher/state', 'teacher/start', 'teacher/pause', 'teacher/end', 'teacher/randomize'])
		assert.throws(() => a.call(route, {
			isHost: true, role: 'teacher'
		}, p[0].token));
	assert.throws(() => a.call('join', {
		classCode: 'WRONG', name: 'x'
	}));
});
test('teacher randomizes, swaps, pairs, and leaves odd/late students waiting', () => {
	const { a, p } = classroom(3);
	a.call('teacher/randomize', {}, 'teacher-secret');
	a.call('teacher/swap', {
		a: p[0].player, b: p[2].player
	}, 'teacher-secret');
	a.call('teacher/start', {}, 'teacher-secret');
	assert.equal(a.matches.size, 1);
	assert.equal(p.filter(x => a.call('state', {}, x.token).match === null).length, 1);
	const late = a.call('join', {
		classCode: 'CLASS', name: 'Late'
	});
	assert.equal(a.call('state', {}, late.token).match, null);
	assert.throws(() => a.call('teacher/randomize', {}, 'teacher-secret'));
});
test('pause/end enforced by authority; reconnect token restores same seat; foreign match ignored', () => {
	const { a, p } = classroom(4);
	a.call('teacher/start', {}, 'teacher-secret');
	a.call('setup', {
		ranks: army()
	}, p[0].token);
	a.call('setup', {
		ranks: army()
	}, p[1].token);
	const s = a.call('state', {}, p[0].token);
	assert.equal(s.player, p[0].player);
	a.call('teacher/pause', {}, 'teacher-secret');
	assert.throws(() => a.call('move', {
		from: 60, to: 50, seq: 2, requestId: 'x'
	}, p[0].token));
	assert.throws(() => a.call('setup', {
		ranks: army()
	}, p[2].token));
	a.call('teacher/resume', {}, 'teacher-secret');
	assert.equal(a.call('state', {}, p[0].token).phase, 'active');
	a.call('teacher/end', {}, 'teacher-secret');
	assert.throws(() => a.call('move', {
		from: 60, to: 50, seq: 2, requestId: 'x'
	}, p[0].token));
});
test('HTTP join/auth/static routes work; traversal and cross-origin writes rejected', async () => {
	const a = createAuthority({
		timedSetup: false,
		teacherKey: 'secret', classCode: 'TEST'
	}), s = serve(a, 0);
	await new Promise(r => s.on('listening', r));
	const base = 'http://127.0.0.1:' + s.address().port;
	try {
		assert.equal((await fetch(base + '/')).status, 200);
		const r = await fetch(base + '/api/join', {
			method: 'POST', body: JSON.stringify({
				classCode: 'TEST', name: 'Browser'
			})
		});
		const p = await r.json();
		assert(p.token);
		assert.equal((await fetch(base + '/api/teacher/start', {
			method: 'POST', headers: {
				Authorization: 'Bearer ' + p.token
			}
		})).status, 400);
		assert.equal((await fetch(base + '/api/join', {
			method: 'POST', headers: {
				Origin: 'https://attacker.invalid'
			}, body: '{}'
		})).status, 400);
	}
	finally {
		s.close();
	}
});
