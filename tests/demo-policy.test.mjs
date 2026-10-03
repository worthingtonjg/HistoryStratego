import test from 'node:test';
import assert from 'node:assert/strict';
import { planDemoMoves as plan } from '../tools/demo-policy.mjs';
const own = (rank = '3') => ({
	side: 0, rank
}), enemy = () => ({
	side: 1, rank: '?'
});
function fixture(pieces = {}, events = []) {
	const board = Array(100).fill(null);
	for (const [i, p] of Object.entries(pieces))
		board[i] = p;
	return {
		id: 'test', seq: events.at(-1)?.seq || 2, side: 0, phase: 'play', turn: 0, board, events
	};
}
const bomb = (to, seq = 3, outcome = -1) => ({
	kind: 'combat', side: 0, from: to + 10, to, seq, attacker: '2', defender: 'B', outcome
});
test('unknown ranks and formation proximity never reveal bombs', () => {
	const m = fixture({
		60: own(), 30: enemy(), 31: enemy()
	});
	const p = plan(m);
	assert.deepEqual(p.memory.bombs, {});
	assert.equal(p.memory.assignment, null);
});
test('discovery uses own combat only; replay and reconnect retain one discovery', () => {
	const m = fixture({
		60: own(), 30: enemy()
	}, [bomb(30), {
		...bomb(31, 4), side: 1
	}]);
	let p = plan(m);
	assert.deepEqual(Object.keys(p.memory.bombs), ['30']);
	const id = p.memory.assignment.minerId;
	p = plan(m, JSON.parse(JSON.stringify(p.memory)));
	assert.equal(p.memory.assignment.minerId, id);
	assert.equal(p.memory.bombs[30].discoveredSeq, 3);
});
test('nonminers never attack discovered bombs, including scouts at distance', () => {
	const p = plan(fixture({
		60: own('2'), 40: own('10'), 30: enemy()
	}, [bomb(30)]));
	assert.ok(p.candidates.length);
	assert.ok(p.candidates.every(c => c.to !== 30));
	assert.equal(p.status, 'known-bombs-no-reachable-miner');
});
test('closest reachable miner uses BFS around lakes instead of Manhattan', () => {
	const p = plan(fixture({
		62: own(), 35: own(), 32: enemy()
	}, [bomb(32)]));
	const a = p.memory.assignment;
	assert.equal(p.memory.miners[a.minerId], 35);
	assert.equal(p.candidates[0].reason, 'assigned-bomb-route');
});
test('one assignment stays stable when another miner gets closer', () => {
	const m = fixture({
		60: own(), 68: own(), 30: enemy(), 39: enemy()
	}, [bomb(30), bomb(39, 4)]);
	let p = plan(m);
	const a = structuredClone(p.memory.assignment), assigned = p.memory.miners[a.minerId];
	const other = Object.values(p.memory.miners).find(i => i !== assigned);
	m.board[other] = null;
	m.board[40] = own();
	m.events.push({
		kind: 'move', side: 0, from: other, to: 40, seq: 5
	});
	m.seq = 5;
	p = plan(m, p.memory);
	assert.deepEqual(p.memory.assignment, a);
	assert.equal(p.candidates.filter(c => c.reason === 'assigned-bomb-route').length, 1);
	assert.ok(p.candidates.filter(c => c.to === 39).every(c => p.memory.miners[a.minerId] === c.from && a.bombSquare === 39));
});
test('dead assigned miner replaced without forgetting bomb', () => {
	const m = fixture({
		60: own(), 68: own(), 30: enemy()
	}, [bomb(30)]);
	let p = plan(m);
	const old = p.memory.assignment.minerId, at = p.memory.miners[old];
	m.board[at] = null;
	m.seq = 4;
	m.events.push({
		kind: 'combat', side: 1, from: at - 10, to: at, seq: 4, attacker: '10', defender: '3', outcome: 0
	});
	p = plan(m, p.memory);
	assert.notEqual(p.memory.assignment.minerId, old);
	assert.equal(p.memory.bombs[30].removed, false);
});
test('disarmed bomb remains history but is never targeted; next bomb queued', () => {
	const m = fixture({
		60: own(), 30: enemy(), 39: enemy()
	}, [bomb(30), bomb(39, 4)]);
	let p = plan(m);
	m.board[30] = own();
	m.board[60] = null;
	m.seq = 5;
	m.events.push({
		...bomb(30, 5, 1), from: 60, attacker: '3'
	});
	p = plan(m, p.memory);
	assert.equal(p.memory.bombs[30].removed, true);
	assert.equal(p.memory.assignment.bombSquare, 39);
});
test('observed empty square clears target without erasing historical discovery', () => {
	const m = fixture({
		60: own(), 30: enemy()
	}, [bomb(30)]);
	let p = plan(m);
	m.board[30] = null;
	m.seq++;
	p = plan(m, p.memory);
	assert.equal(p.memory.assignment, null);
	assert.equal(p.memory.bombs[30].removed, true);
});
test('friendly blockers and lakes do not produce illegal jumps; fallback remains', () => {
	const m = fixture({
		60: own(), 50: own('B'), 61: own('B'), 70: own('B'), 89: own('4'), 30: enemy()
	}, [bomb(30)]);
	const p = plan(m);
	assert.equal(p.memory.assignment, null);
	assert.ok(p.candidates.length);
	assert.ok(p.candidates.every(c => c.from !== 60));
});
test('miner identity survives own move, reconnect, and repeated polls', () => {
	const m = fixture({
		60: own(), 30: enemy()
	}, [bomb(30)]);
	let p = plan(m);
	const id = p.memory.assignment.minerId;
	m.board[60] = null;
	m.board[50] = own();
	m.seq = 4;
	m.events.push({
		kind: 'move', side: 0, from: 60, to: 50, seq: 4
	});
	p = plan(m, JSON.parse(JSON.stringify(p.memory)));
	assert.equal(p.memory.miners[id], 50);
	assert.equal(p.memory.visits[50], 1);
	p = plan(m, p.memory);
	assert.equal(p.memory.visits[50], 1);
});
test('new match resets memories and inputs are not mutated; seats independent', () => {
	const m = fixture({
		60: own(), 30: enemy()
	}, [bomb(30)]), copy = structuredClone(m), a = plan(m), before = structuredClone(a.memory);
	plan(m, a.memory);
	assert.deepEqual(m, copy);
	assert.deepEqual(a.memory, before);
	assert.deepEqual(plan({
		...m, id: 'next', events: []
	}, a.memory).memory.bombs, {});
	const other = {
		...m, side: 1, board: m.board.map(p => p ? {
			side: p.side, rank: p.side === 1 ? '3' : '?'
		} : null)
	};
	assert.deepEqual(plan(other, a.memory).memory.bombs, {});
});
test('safe route detours around unknown-enemy adjacency zones', () => {
	const m = fixture({
		60: own(), 30: enemy(), 41: enemy()
	}, [bomb(30)]), p = plan(m);
	assert.ok(p.memory.assignment);
	assert.notEqual(p.candidates[0].to, 50);
	assert.ok(p.candidates.every(c => c.to !== 40 && c.to !== 51));
});
test('threatened miner retreats to safe square before bomb progress', () => {
	const p = plan(fixture({
		60: own(), 61: enemy(), 30: enemy(), 85: own('4')
	}, [bomb(30)]));
	assert.equal(p.candidates[0].from, 60);
	assert.ok([50, 70].includes(p.candidates[0].to));
});
test('trapped miner holds while another piece moves', () => {
	const p = plan(fixture({
		60: own(), 61: enemy(), 50: own('B'), 70: own('F'), 85: own('4')
	}));
	assert.ok(p.candidates.length);
	assert.ok(p.candidates.every(c => c.from !== 60));
});
test('known bomb mission tolerates an unknown adjacent defender', () => {
	let m = fixture({
		40: own(), 30: enemy()
	}, [bomb(30)]), p = plan(m);
	assert.equal(p.candidates[0].to, 30);
	m.board[31] = enemy();
	p = plan(m, p.memory);
	assert.equal(p.candidates[0].to, 30);
	assert.ok(p.memory.assignment);
});
test('known stronger defender may guard the final disarm square without dropping mission', () => {
	const m = fixture({
		60: own(), 30: enemy()
	}, [bomb(30)]);
	let p = plan(m);
	m.board[31] = enemy();
	m.seq++;
	m.events.push({ ...bomb(31, m.seq), defender: '6' });
	p = plan(m, p.memory);
	assert.ok(p.memory.assignment);
	assert.equal(p.memory.bombs[30].removed, false);
	assert.ok(p.candidates.length);
	m.board[31] = null;
	m.seq++;
	p = plan(m, p.memory);
	assert.ok(p.memory.assignment);
});
test('only purposeful bomb approaches may risk unknown enemy adjacency', () => {
	let seed = 472;
	const rnd = n => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed % n;
	};
	for (let k = 0; k < 100; k++) {
		const m = fixture({
			60: own(), 68: own(), 30: enemy()
		}, [bomb(30)]);
		for (let j = 0; j < 8; j++) {
			const at = rnd(100);
			if (!m.board[at] && ![42, 43, 46, 47, 52, 53, 56, 57].includes(at))
				m.board[at] = enemy();
		}
		const p = plan(m);
		assert.deepEqual(plan(m), p);
		for (const c of p.candidates) {
			if (m.board[c.from].rank !== '3' || c.reason === 'assigned-bomb-route')
				continue;
			for (let i = 0; i < 100; i++)
				if (m.board[i]?.side === 1 && i !== 30) {
					const d = Math.abs(i % 10 - c.to % 10) + Math.abs(Math.floor(i / 10) - Math.floor(c.to / 10));
					assert.ok(d > 1);
				}
		}
	}
});
