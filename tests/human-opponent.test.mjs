import test from 'node:test';
import assert from 'node:assert/strict';
import { opponentAction, createOpponent } from '../tools/human-opponent.mjs';
import { createMatch, view, select, move, acknowledge } from '../server/game.mjs';
function fixture() {
	const m = createMatch(['npc', 'human']);
	m.phase = 'play';
	m.ready = [true, true];
	m.board[60] = {
		side: 0, rank: '2', id: 'npc'
	};
	m.board[30] = {
		side: 1, rank: '4', id: 'human'
	};
	m.board[0] = {
		side: 1, rank: '2', id: 'human-spare'
	};
	m.board[99] = {
		side: 0, rank: '4', id: 'npc-spare'
	};
	return m;
}
function harness(m = fixture()) {
	let phase = 'active', time = 0;
	const calls = [], events = [];
	const state = () => ({
		phase, match: view(m, 0)
	});
	const command = async (action, b = {}) => {
		calls.push(action);
		if (action === 'select')
			select(m, 0, b.from, m.seq);
		if (action === 'move')
			move(m, 0, b.from, b.to, m.seq, 'test-' + m.seq);
		if (action === 'ack')
			acknowledge(m, 0, m.reveal.seq);
		return state();
	};
	return {
		m, calls, events, state, command, setPhase: p => phase = p, setTime: t => time = t, now: () => time, emit: x => events.push(x)
	};
}
test('single-seat gate waits for setup, human turn, human Continue, pause/end and finished match', () => {
	const h = harness(), s = h.state();
	assert.equal(opponentAction(s), 'move');
	s.match.turn = 1;
	assert.equal(opponentAction(s), 'wait-human-turn');
	s.match.phase = 'setup';
	assert.equal(opponentAction(s), 'wait-setup');
	s.match.phase = 'play';
	s.match.ready[1] = false;
	assert.equal(opponentAction(s), 'wait-setup');
	s.phase = 'paused';
	assert.equal(opponentAction(s), 'wait-session');
	s.phase = 'ended';
	assert.equal(opponentAction(s), 'wait-session');
	s.phase = 'active';
	s.match.phase = 'over';
	s.match.battle = {
		ack: [true, false]
	};
	s.match.blocked = true;
	assert.equal(opponentAction(s), 'wait-human-continue');
	s.match.battle = null;
	s.match.blocked = false;
	assert.equal(opponentAction(s), 'finished');
});
test('NPC plans from own view, selects authoritative targets and moves only its own turn', async () => {
	const h = harness(), bot = createOpponent({
		...h, delay: async () => {
		}
	});
	assert(h.state().match.board.filter(p => p?.side === 1).every(p => p.rank === '?'));
	await bot.tick();
	assert.deepEqual(h.calls.slice(-3), ['select', 'status', 'move']);
	assert.equal(h.m.seq, 1);
	assert.equal(h.m.turn, 1);
	assert(h.events.some(e => e.status === 'moved'));
	h.calls.length = 0;
	await bot.tick();
	assert(!h.calls.includes('move'));
	assert(h.calls.every(a => ['status', 'select', 'move', 'ack'].includes(a)));
});
test('NPC acknowledges only its own reveal after readable delay and waits for human Continue', async () => {
	const h = harness();
	move(h.m, 0, 60, 30, 0, 'combat');
	const bot = createOpponent({
		...h, delay: async () => {
		}
	});
	await bot.tick();
	h.setTime(7999);
	await bot.tick();
	assert.deepEqual(h.m.reveal.ack, [false, false]);
	h.setTime(8000);
	await bot.tick();
	assert.deepEqual(h.m.reveal.ack, [true, false]);
	await bot.tick();
	assert(h.m.reveal);
	assert.equal(h.calls.filter(a => a === 'ack').length, 1);
	assert(h.events.some(e => e.status === 'wait-human-continue'));
});
test('pause resets readable hold; pause during visible selection prevents move', async () => {
	const h = harness();
	move(h.m, 0, 60, 30, 0, 'combat');
	const bot = createOpponent({
		...h, delay: async () => {
		}
	});
	await bot.tick();
	h.setTime(7000);
	h.setPhase('paused');
	await bot.tick();
	h.setTime(9000);
	h.setPhase('active');
	await bot.tick();
	h.setTime(16000);
	await bot.tick();
	assert.deepEqual(h.m.reveal.ack, [false, false]);
	h.setTime(17000);
	await bot.tick();
	assert.deepEqual(h.m.reveal.ack, [true, false]);
	const j = harness(), other = createOpponent({
		...j, delay: async () => j.setPhase('paused')
	});
	await other.tick();
	assert.equal(j.m.seq, 0);
	assert(!j.calls.includes('move'));
});
test('policy stall reports once per unchanged sequence and sends no repeated actions', async () => {
	const h = harness();
	h.m.board.fill(null);
	h.m.board[99] = {
		side: 0, rank: 'F', id: 'flag'
	};
	const bot = createOpponent({
		...h, delay: async () => {
		}
	});
	await bot.tick();
	await bot.tick();
	assert(h.events.some(e => e.status === 'stalled'));
	assert(h.calls.every(a => a === 'status'));
});
test('last-resort legal fallback avoids a policy softlock when a trapped Miner has only a known losing attack', async () => {
	const h = harness();
	h.m.board.fill(null);
	h.m.seq = 3;
	h.m.board[60] = {
		side: 0, rank: '3', id: 'miner'
	};
	h.m.board[50] = {
		side: 0, rank: 'B', id: 'bomb'
	};
	h.m.board[70] = {
		side: 0, rank: 'F', id: 'flag'
	};
	h.m.board[61] = {
		side: 1, rank: '10', id: 'marshal'
	};
	h.m.events = [{
		kind: 'combat', seq: 3, side: 0, from: 71, to: 61, attacker: '2', defender: '10', outcome: -1, ack: [true, true]
	}];
	const bot = createOpponent({
		...h, delay: async () => {
		}
	});
	await bot.tick();
	assert(h.events.some(e => e.status === 'policy-fallback' && e.reason === 'forced-known-loss'));
	assert.equal(h.m.seq, 4);
	assert.equal(h.m.board[60], null);
	assert.equal(h.m.winner, -1); // The policy never invents a terminal result.
});
for (const alternative of [true, false])
	test('authoritative two-phase selection ' + (alternative ? 'exhausts nonlosing alternatives first' : 'reselects cached fallback before moving'), async () => {
		const board = Array(100).fill(null);
		board[60] = {
			side: 0, rank: '6'
		};
		board[50] = {
			side: 1, rank: '?'
		};
		board[90] = {
			side: 0, rank: '4'
		};
		if (!alternative)
			board[80] = {
				side: 0, rank: 'B'
			};
		const state = {
			phase: 'active', match: {
				id: 'fallback', seq: 3, side: 0, turn: 0, phase: 'play', ready: [true, true], board, events: [{
					kind: 'combat', seq: 3, side: 0, from: 60, to: 50, attacker: '2', defender: '7', outcome: -1
				}]
			}
		};
		const calls = [], reports = [];
		const command = async (action, b = {}) => {
			calls.push({
				action, ...b
			});
			if (action === 'select')
				state.match.selection = {
					from: b.from, targets: b.from === 60 ? [{
						to: 50
					}] : alternative ? [{
						to: 80
					}] : []
				};
			if (action === 'move') {
				assert.equal(state.match.selection.from, b.from);
				assert(state.match.selection.targets.some(t => t.to === b.to));
				state.match.turn = 1;
				state.match.seq++;
			}
			return structuredClone(state);
		};
		const bot = createOpponent({
			command, delay: async () => {
			}, emit: e => reports.push(e)
		});
		await bot.tick();
		const move = calls.find(c => c.action === 'move');
		assert.deepEqual([move.from, move.to], alternative ? [90, 80] : [60, 50]);
		assert.equal(reports.some(e => e.status === 'policy-fallback'), !alternative);
		if (!alternative)
			assert.equal(calls.filter(c => c.action === 'select' && c.from === 60).length, 2);
	});
for (const side of [0, 1])
	for (const rank of ['1', '3'])
		test('home exception needs authoritative necessity, orientation ' + side + ' rank ' + rank, async () => {
			for (const hasOtherLegal of [true, false]) {
				const mirror = i => side ? 99 - i : i, board = Array(100).fill(null);
				board[mirror(50)] = {
					side, rank
				};
				board[mirror(51)] = {
					side, rank: 'B'
				};
				board[mirror(60)] = {
					side, rank: 'F'
				};
				if (hasOtherLegal)
					board[mirror(90)] = {
						side, rank: '4'
					};
				const state = {
					phase: 'active', match: {
						id: 'home-' + side, seq: 2, side, turn: side, phase: 'play', ready: [true, true], board, events: []
					}
				}, calls = [], reports = [];
				const command = async (action, b = {}) => {
					calls.push({
						action, ...b
					});
					if (action === 'select')
						state.match.selection = {
							from: b.from, targets: [{
								to: b.from === mirror(50) ? mirror(40) : mirror(80)
							}]
						};
					if (action === 'move') {
						assert.equal(state.match.selection.from, b.from);
						state.match.turn = 1 - side;
						state.match.seq++;
					}
					return structuredClone(state);
				};
				await createOpponent({
					command, delay: async () => {
					}, emit: e => reports.push(e)
				}).tick();
				const moved = calls.find(c => c.action === 'move');
				assert.deepEqual([moved.from, moved.to], hasOtherLegal ? [mirror(90), mirror(80)] : [mirror(50), mirror(40)]);
				assert.equal(reports.some(e => e.reason === 'forced-home-crossing'), !hasOtherLegal);
			}
		});
