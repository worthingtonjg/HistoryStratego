import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, move, view, select, acknowledge, legal } from '../server/game.mjs';
import { planDemoMoves } from '../tools/demo-policy.mjs';
const piece = (side, rank, id) => ({
	side, rank, id
});
function act(m, side, memory) {
	const plan = planDemoMoves(view(m, side), memory);
	for (const from of new Set(plan.candidates.map(c => c.from))) {
		select(m, side, from, m.seq);
		const choice = plan.candidates.find(c => c.from === from && m.selection.targets.some(t => t.to === c.to));
		if (choice) {
			move(m, side, choice.from, choice.to, m.seq, 'policy-' + m.seq);
			return {
				plan, choice
			};
		}
	}
	return {
		plan, choice: null
	};
}
function ack(m) {
	if (m.reveal) {
		const seq = m.reveal.seq;
		for (const side of [0, 1])
			acknowledge(m, side, seq);
	}
}
test('redacted policy to authoritative selection: discover, reconnect, route and disarm', () => {
	const m = createMatch(['a', 'b']);
	m.phase = 'play';
	m.ready = [true, true];
	m.board[60] = piece(0, '2', 'scout');
	m.board[70] = piece(0, '3', 'miner');
	m.board[41] = piece(0, '10', 'marshal');
	m.board[99] = piece(0, 'F', 'flag');
	m.board[50] = piece(1, 'B', 'bomb');
	m.board[0] = piece(1, '2', 'enemy-scout');
	m.board[9] = piece(1, 'F', 'enemy-flag');
	move(m, 0, 60, 50, m.seq, 'discover');
	ack(m);
	move(m, 1, 0, 1, m.seq, 'reply-1');
	const first = act(m, 0);
	assert.deepEqual([first.choice.from, first.choice.to], [70, 60]);
	assert(first.plan.candidates.every(c => c.from !== 41 || c.to !== 50));
	const memory = JSON.parse(JSON.stringify(first.plan.memory));
	move(m, 1, 1, 2, m.seq, 'reply-2');
	const second = act(m, 0, memory);
	assert.deepEqual([second.choice.from, second.choice.to], [60, 50]);
	assert.equal(m.reveal.attacker, '3');
	assert.equal(m.reveal.defender, 'B');
	assert.equal(m.reveal.outcome, 1);
	ack(m);
	const after = planDemoMoves(view(m, 0), second.plan.memory);
	assert.equal(after.memory.bombs[50].removed, true);
	assert.equal(after.memory.assignment, null);
	assert.equal(m.phase, 'play');
	assert.equal(m.winner, -1);
});
test('safety-only policy stall does not pretend that legal moves or a winner changed', () => {
	const m = createMatch(['a', 'b']);
	m.phase = 'play';
	m.board[60] = piece(0, '3', 'miner');
	m.board[50] = piece(0, 'B', 'ownbomb');
	m.board[70] = piece(0, 'F', 'ownflag');
	m.board[61] = piece(1, '10', 'enemy');
	assert(legal(m, 0, 60, 61));
	const result = act(m, 0);
	assert.equal(result.choice, null);
	assert.equal(m.phase, 'play');
	assert.equal(m.winner, -1);
	assert.equal(m.seq, 0);
});
