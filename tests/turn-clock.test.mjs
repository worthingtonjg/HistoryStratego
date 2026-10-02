import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthority, serve } from '../server/server.mjs';
import { army, legal, view } from '../server/game.mjs';
import { planDemoMoves } from '../tools/demo-policy.mjs';
function fixture(timedSetup = false) {
	let time = 1000000;
	const a = createAuthority({
		classCode: 'TEST', teacherKey: 'test', now: () => time, timedSetup
	});
	const p = [a.call('join', {
		classCode: 'TEST'
	}), a.call('join', {
		classCode: 'TEST'
	})];
	a.call('teacher/start', {}, 'test');
	const m = [...a.matches.values()][0];
	const call = (s, r, b = {}) => a.call(r, {
		matchId: m.id, ...b
	}, p[s].token);
	if (!timedSetup) {
		call(0, 'setup', {
			ranks: army()
		});
		call(1, 'setup', {
			ranks: army()
		});
	}
	return {
		a, m, p, call, advance(ms) {
			time += ms;
			a.tick();
		}, time: () => time
	};
}
function expire(f) {
	f.advance(2000);
	f.advance(30000);
}
test('30 second deadline announces once, consumes no stale selection and atomically rejects manual race', () => {
	const f = fixture();
	const seq = f.m.seq;
	f.advance(2000);
	f.advance(29999);
	assert.equal(f.call(0, 'state').match.turnClock.remainingMs, 1);
	const from = f.m.board.findIndex((p, i) => p?.side === 0 && Array.from({
		length: 100
	}, (_, j) => j).some(j => legal(f.m, 0, i, j)));
	f.call(0, 'select', {
		from, seq
	});
	f.advance(1);
	assert.equal(f.m.selection, null);
	assert.equal(f.call(1, 'state').match.turnClock.noticeRemainingMs, 3000);
	assert.throws(() => f.call(0, 'move', {
		from, to: from - 10, seq, requestId: 'race'
	}), /announced/);
	f.advance(2999);
	assert.equal(f.m.seq, seq);
	f.advance(1);
	assert.equal(f.m.seq, seq + 1);
	assert.equal(f.m.events.at(-1).automatic, true);
	for (let n = 0; n < 20; n++)
		f.call(0, 'state');
	assert.equal(f.m.seq, seq + 1);
	assert.throws(() => f.call(0, 'move', {
		from, to: from - 10, seq, requestId: 'race'
	}), /Stale|turn|pending combat/);
});
test('pause freezes turn and announcement, reconnect does not reset either', () => {
	const f = fixture();
	f.advance(2000);
	f.advance(15000);
	f.a.call('teacher/pause', {}, 'test');
	f.advance(999999);
	assert.equal(f.call(0, 'state').match.turnClock.remainingMs, 15000);
	f.a.call('teacher/resume', {}, 'test');
	f.advance(15000);
	f.a.call('teacher/pause', {}, 'test');
	f.advance(999999);
	assert.equal(f.a.call('join', {
		classCode: 'TEST'
	}, f.p[0].token).match.turnClock.noticeRemainingMs, 3000);
	f.a.call('teacher/resume', {}, 'test');
	f.advance(3000);
	assert.equal(f.m.seq, 3);
});
test('actual setup expiry blocks both seats for three seconds; early locking does not', () => {
	const f = fixture(true);
	f.call(0, 'setup/begin');
	f.call(1, 'setup/begin');
	f.call(1, 'setup', {
		revision: 0
	});
	f.advance(300000);
	assert.equal(f.call(0, 'state').match.setup.noticeRemainingMs, 3000);
	assert.equal(f.call(1, 'state').match.setup.noticeRemainingMs, 0);
	assert.equal(f.call(1, 'state').match.setupBlocked, true);
	assert.throws(() => f.call(0, 'select', {
		from: 60, seq: f.m.seq
	}), /setup timeout/);
	f.a.call('teacher/pause', {}, 'test');
	f.advance(50000);
	f.a.call('teacher/resume', {}, 'test');
	assert.equal(f.call(0, 'state').match.setup.noticeRemainingMs, 3000);
	f.advance(3000);
	assert.equal(f.call(0, 'state').match.setupBlocked, false);
	assert.equal(f.call(0, 'state').match.turnClock.remainingMs, 30000);
});
test('policy decision is invariant under unrevealed enemy ranks and journal knowledge is retained', () => {
	const f = fixture();
	const own = view(f.m, 0), other = structuredClone(own);
	for (const p of other.board)
		if (p?.side === 1)
			Object.defineProperty(p, 'rank', {
				get() {
					throw Error('hidden rank read');
				}
			});
	const a = planDemoMoves(own, null), b = planDemoMoves(other, null);
	assert.deepEqual(a.candidates, b.candidates);
	expire(f);
	f.advance(3000);
	assert.ok(f.m.timeoutMemory[0]);
});
test('combat suspends clock; final capture remains acknowledged; no-legal-move is defeat', () => {
	const f = fixture();
	f.m.board = Array(100).fill(null);
	f.m.board[60] = {
		id: 'own', side: 0, rank: '10'
	};
	f.m.board[50] = {
		id: 'flag', side: 1, rank: 'F'
	};
	expire(f);
	f.advance(3000);
	assert.equal(f.m.phase, 'over');
	assert.equal(f.m.winner, 0);
	assert.ok(f.m.reveal);
	f.advance(999999);
	assert.equal(f.m.seq, 3);
	const g = fixture();
	g.m.board = Array(100).fill(null);
	g.m.board[99] = {
		id: 'flag', side: 0, rank: 'F'
	};
	expire(g);
	g.advance(3000);
	assert.equal(g.m.phase, 'over');
	assert.equal(g.m.winner, 1);
});
test('manual move immediately before deadline wins race; ended round never auto moves', () => {
	const f = fixture();
	f.advance(2000);
	f.advance(29999);
	const choice = planDemoMoves(view(f.m, 0), null).candidates.find(p => legal(f.m, 0, p.from, p.to));
	f.call(0, 'move', {
		...choice, seq: f.m.seq, requestId: 'manual'
	});
	f.advance(1);
	assert.equal(f.m.seq, 3);
	f.a.call('teacher/end', {}, 'test');
	f.advance(999999);
	assert.equal(f.m.seq, 3);
});
test('both sides receive independent deadlines and combat blocks until final acknowledgment', () => {
	const f = fixture();
	f.m.board = Array(100).fill(null);
	f.m.board[60] = {
		id: 'a', side: 0, rank: '5'
	};
	f.m.board[50] = {
		id: 'b', side: 1, rank: '4'
	};
	f.m.board[0] = {
		id: 'c', side: 1, rank: '2'
	};
	f.m.board[99] = {
		id: 'd', side: 0, rank: 'F'
	};
	f.m.board[9] = {
		id: 'e', side: 1, rank: 'F'
	};
	expire(f);
	f.advance(3000);
	assert.ok(f.m.reveal);
	f.advance(100000);
	assert.equal(f.m.seq, 3);
	f.call(0, 'ack', {
		seq: 3
	});
	f.advance(100000);
	assert.equal(f.m.seq, 3);
	f.call(1, 'ack', {
		seq: 3
	});
	assert.equal(f.call(1, 'state').match.turnClock.remainingMs, 30000);
	expire(f);
	f.advance(3000);
	assert.equal(f.m.seq, 4);
	assert.ok(f.m.timeoutMemory[1]);
});
test('late notice polling shows remaining only and fresh round resets deadline and knowledge', () => {
	const f = fixture(true);
	f.call(0, 'setup/begin');
	f.advance(300000);
	f.advance(2500);
	assert.equal(f.a.call('join', {
		classCode: 'TEST'
	}, f.p[0].token).match.setup.noticeRemainingMs, 500);
	f.advance(500);
	assert.equal(f.call(0, 'state').match.setup.noticeRemainingMs, 0);
	f.call(1, 'setup/begin');
	f.call(1, 'setup', {
		revision: 0
	});
	expire(f);
	f.advance(3000);
	f.a.call('teacher/end', {}, 'test');
	f.call(0, 'state');
	f.call(1, 'state');
	f.a.call('teacher/start', {}, 'test');
	const m = [...f.a.matches.values()][0];
	assert.notEqual(m.id, f.m.id);
	assert.deepEqual(m.timeoutMemory, [null, null]);
	assert.equal(f.a.call("state", {}, f.p[0].token).match.turnClock.remainingMs, 30000);
});
test('HTTP contract exposes notice clocks to students and spectator without internal policy memory', async () => {
	const f = fixture(true), server = serve(f.a, 0);
	await new Promise(resolve => server.once('listening', resolve));
	try {
		f.call(0, 'setup/begin');
		f.advance(300000);
		const get = async (route, token, body = {}) => (await fetch('http://127.0.0.1:' + server.address().port + '/api/' + route, {
			method: 'POST', headers: {
				authorization: 'Bearer ' + token, 'content-type': 'application/json'
			}, body: JSON.stringify(body)
		})).json();
		const s = await get('state', f.p[0].token), t = await get('teacher/spectate', 'test', {
			matchId: f.m.id
		});
		assert.equal(s.match.setup.noticeRemainingMs, 3000);
		assert.equal(t.match.setupBlocked, true);
		assert.equal(t.match.turnClock.enabled, true);
		assert.equal(s.match.timeoutMemory, undefined);
		assert.equal(t.match.timeoutMemory, undefined);
		assert.ok(s.match.board.every(p => !p || p.side === s.match.side || p.rank === '?'));
	}
	finally {
		await new Promise(resolve => server.close(resolve));
	}
});
test('sparse polling still expires wall-clock turn but retains a fresh announcement', () => {
	const f = fixture();
	f.advance(32000);
	assert.equal(f.call(0, 'state').match.turnClock.noticeRemainingMs, 3000);
	assert.equal(f.m.seq, 2);
	f.advance(3000);
	assert.equal(f.m.seq, 3);
});
