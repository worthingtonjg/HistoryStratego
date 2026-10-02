import test from 'node:test';
import assert from 'node:assert/strict';
import { planDemoMoves as plan } from '../tools/demo-policy.mjs';
import { observeRanks, knownOutcome } from '../tools/public-knowledge.mjs';
const own = (rank = '4') => ({
	side: 0, rank
}), enemy = () => ({
	side: 1, get rank() {
		throw Error('Enemy rank peek');
	}
});
function fixture(pieces = {}, events = []) {
	const board = Array(100).fill(null);
	for (const [i, p] of Object.entries(pieces))
		board[i] = p;
	return {
		id: 'memory', side: 0, seq: events.at(-1)?.seq || 2, phase: 'play', turn: 0, board, events
	};
}
const reveal = (to, rank = '10', seq = 3) => ({
	kind: 'combat', seq, side: 0, from: to + 10, to, attacker: '2', defender: rank, outcome: -1
});
function mirror(m) {
	return {
		...m, side: 1, board: m.board.map(p => p ? p.side === 0 ? {
			side: 1, rank: p.rank
		} : {
			side: 0, get rank() {
				throw Error('Enemy rank peek');
			}
		} : null).reverse(), events: m.events.map(e => ({
			...e, side: 1 - e.side, from: 99 - e.from, to: 99 - e.to
		}))
	};
}
const ranks = k => Object.values(k.pieces);
test('known opponent identity follows public movement and combat through reconnect without rank peeking', () => {
	const m = fixture({
		60: own(), 30: enemy()
	}, [reveal(30)]);
	let k = observeRanks(m);
	const id = Object.keys(k.pieces)[0];
	m.board[30] = null;
	m.board[31] = enemy();
	m.events.push({
		kind: 'move', seq: 4, side: 1, from: 30, to: 31
	});
	m.seq = 4;
	k = observeRanks(m, JSON.parse(JSON.stringify(k)));
	assert.equal(k.pieces[id].square, 31);
	assert.equal(k.pieces[id].rank, '10');
	assert.deepEqual(observeRanks(m, k), k);
	assert.deepEqual(observeRanks(m), k);
	m.board[31] = null;
	m.board[41] = enemy();
	m.events.push({
		kind: 'combat', seq: 5, side: 1, from: 31, to: 41, attacker: '10', defender: '6', outcome: 1
	});
	m.seq = 5;
	k = observeRanks(m, k);
	assert.equal(k.pieces[id].square, 41);
	m.board[41] = null;
	m.events.push({
		kind: 'combat', seq: 6, side: 0, from: 51, to: 41, attacker: '10', defender: '10', outcome: 0
	});
	m.seq = 6;
	assert.deepEqual(observeRanks(m, k).pieces, {});
});
test('missing moves, removal, different match and unknown replacements clear stale ranks', () => {
	const m = fixture({
		60: own(), 30: enemy()
	}, [reveal(30)]), k = observeRanks(m);
	assert.deepEqual(observeRanks({
		...m, seq: 5, events: []
	}, k).pieces, {});
	assert.deepEqual(observeRanks({
		...m, id: 'new', events: []
	}, k).pieces, {});
	m.board[30] = null;
	assert.deepEqual(observeRanks(m, k).pieces, {});
	m.board[31] = enemy();
	m.seq = 6;
	m.events = [{
		kind: 'move', side: 1, from: 30, to: 31, seq: 6
	}];
	assert.deepEqual(observeRanks(m, k).pieces, {});
	m.events.push(reveal(31, '7', 7));
	m.seq = 7;
	assert.equal(ranks(observeRanks(m, k))[0].rank, '7');
});
test('known losses are excluded while ties and special combat rules are classified correctly', () => {
	const m = fixture({
		60: own('6'), 50: enemy()
	}, [reveal(50, '7')]);
	let p = plan(m);
	assert(!p.candidates.some(c => c.from === 60 && c.to === 50));
	assert(p.fallback.some(c => c.from === 60 && c.to === 50 && c.reason === 'forced-known-loss'));
	m.board[60] = own('7');
	p = plan(m);
	assert(p.candidates.some(c => c.from === 60 && c.to === 50));
	assert.equal(knownOutcome('1', '10'), 1);
	assert.equal(knownOutcome('10', '1'), 1);
	assert.equal(knownOutcome('1', '6'), -1);
	assert.equal(knownOutcome('3', 'B'), 1);
	assert.equal(knownOutcome('10', 'B'), -1);
	assert.equal(knownOutcome('5', '5'), 0);
	assert.equal(knownOutcome('2', 'F'), 1);
});
test('only Spy gets targeted pursuit; revealed weak or strong ranks do not change ordinary route scoring', () => {
	const a = fixture({
		60: own('10'), 30: enemy(), 35: enemy()
	}), b = fixture({
		60: own('10'), 30: enemy(), 35: enemy()
	}, [reveal(30, '2')]);
	assert.deepEqual(plan(a).candidates, plan(b).candidates);
	const strong = fixture({
		60: own('6'), 30: enemy()
	}, [reveal(30, '10')]);
	assert(plan(strong).candidates.every(c => c.reason === 'ordinary'));
});
test('idle Spy and unassigned Miners stay in their own half in both orientations', () => {
	for (const m of [fixture({
		50: own('1'), 54: own('3'), 58: own('3'), 80: own()
	}), mirror(fixture({
		50: own('1'), 54: own('3'), 58: own('3'), 80: own()
	}))]) {
		const p = plan(m);
		assert.equal(p.memory.spyTarget, null);
		assert.equal(p.memory.assignment, null);
		for (const c of [...p.candidates, ...p.fallback])
			if (['1', '3'].includes(m.board[c.from].rank))
				assert(m.side === 0 ? c.to >= 50 : c.to < 50);
	}
});
test('safe Spy mission crosses the border, stops nonadjacent, then attacks an approaching known Marshal', () => {
	for (const mirrored of [false, true]) {
		let m = fixture({
			60: own('1'), 90: own(), 20: enemy()
		}, [reveal(20)]);
		if (mirrored)
			m = mirror(m);
		let p = plan(m);
		assert(p.memory.spyTarget);
		assert.equal(p.candidates[0].reason, 'spy-standoff-route');
		for (let step = 0; step < 2; step++) {
			const c = p.candidates[0];
			m.board[c.to] = m.board[c.from];
			m.board[c.from] = null;
			m.events.push({
				kind: 'move', side: m.side, from: c.from, to: c.to, seq: ++m.seq
			});
			p = plan(m, p.memory);
		}
		const spy = m.board.findIndex(p => p?.side === m.side && p.rank === '1');
		assert.equal(spy, mirrored ? 59 : 40);
		assert(!p.candidates.some(c => c.from === spy), 'standoff holds while another piece moves');
		const from = mirrored ? 79 : 20, to = mirrored ? 69 : 30;
		m.board[to] = m.board[from];
		m.board[from] = null;
		m.events.push({
			kind: 'move', side: 1 - m.side, from, to, seq: ++m.seq
		});
		p = plan(m, p.memory);
		assert.equal(p.candidates[0].reason, 'spy-known-marshal-attack');
		assert.equal(p.candidates[0].to, to);
	}
});
test('Spy detours around lakes and blockers and never steps adjacent to a known Marshal', () => {
	const m = fixture({
		62: own('1'), 61: own('B'), 72: own('B'), 80: own(), 32: enemy()
	}, [reveal(32)]), p = plan(m);
	assert(p.memory.spyTarget);
	const c = p.candidates[0];
	assert.equal(c.reason, 'spy-standoff-route');
	assert.equal(c.to, 63);
	for (const c of p.candidates.filter(c => c.from === 62))
		assert(![42, 43, 52, 53, 31, 33, 22].includes(c.to));
});
test('unknown Marshal never creates a mission; threatened Spy retreats safely, or holds if trapped', () => {
	let p = plan(fixture({
		60: own('1'), 61: enemy(), 90: own()
	}));
	assert.equal(p.memory.spyTarget, null);
	assert.equal(p.candidates[0].reason, 'spy-safe-retreat');
	assert([50, 70].includes(p.candidates[0].to));
	p = plan(fixture({
		60: own('1'), 61: enemy(), 50: own('B'), 70: own('F'), 90: own()
	}));
	assert(p.candidates.length);
	assert(p.candidates.every(c => c.from !== 60));
});
test('Spy refuses Marshal capture exposing it to another adjacent piece or known Scout ray', () => {
	for (const extra of [31, 39]) {
		const events = [reveal(30)];
		if (extra === 39)
			events.push(reveal(39, '2', 4));
		const m = fixture({
			40: own('1'), 90: own(), 30: enemy(), [extra]: enemy()
		}, events), p = plan(m);
		assert(!p.candidates.some(c => c.from === 40 && c.to === 30));
	}
});
test('mission loss clears Spy target and returns safely home; no continuing pursuit of a replacement', () => {
	let m = fixture({
		40: own('1'), 90: own(), 20: enemy()
	}, [reveal(20)]), p = plan(m);
	assert(p.memory.spyTarget);
	m.board[20] = null;
	m.events.push({
		kind: 'combat', side: 0, from: 21, to: 20, seq: ++m.seq, attacker: '10', defender: '10', outcome: 0
	});
	p = plan(m, p.memory);
	assert.equal(p.memory.spyTarget, null);
	assert.equal(p.candidates[0].reason, 'safe-return-home');
	assert.equal(p.candidates[0].to, 50);
	m.board[20] = enemy();
	p = plan(m, p.memory);
	assert.equal(p.memory.spyTarget, null);
	m.board[40] = null;
	p = plan(m, p.memory);
	assert.equal(p.memory.spyTarget, null);
});
test('only assigned Miner may cross, and a completed mission causes safe homeward movement', () => {
	for (const mirrored of [false, true]) {
		let m = fixture({
			50: own('3'), 58: own('3'), 90: own(), 30: enemy()
		}, [reveal(30, 'B')]);
		if (mirrored)
			m = mirror(m);
		let p = plan(m);
		const assigned = p.memory.miners[p.memory.assignment.minerId];
		assert.equal(assigned, mirrored ? 49 : 50);
		assert(p.candidates.some(c => c.from === assigned && (mirrored ? c.to >= 50 : c.to < 50)));
		for (const c of p.candidates)
			if (m.board[c.from].rank === '3' && c.from !== assigned)
				assert(mirrored ? c.to < 50 : c.to >= 50);
		const bomb = mirrored ? 69 : 30;
		m.board[assigned] = null;
		m.board[bomb] = {
			side: m.side, rank: '3'
		};
		m.events.push({
			kind: 'combat', side: m.side, from: assigned, to: bomb, seq: ++m.seq, attacker: '3', defender: 'B', outcome: 1
		});
		p = plan(m, p.memory);
		assert.equal(p.memory.assignment, null);
		assert.equal(p.candidates[0].reason, 'safe-return-home');
		assert.equal(p.candidates[0].from, bomb);
	}
});
test('home crossing is reserved in a separate last-resort pool', () => {
	const m = fixture({
		50: own('3'), 51: own('B'), 60: own('F')
	}), p = plan(m);
	assert.equal(p.candidates.length, 0);
	assert.equal(p.fallback.length, 0);
	assert.equal(p.boundaryBlocked, 1);
	assert.equal(p.emergency[0].to, 40);
	assert.equal(p.emergency[0].reason, "forced-home-crossing");
});
