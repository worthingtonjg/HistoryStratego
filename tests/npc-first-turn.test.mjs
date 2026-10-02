import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createAuthority } from '../server/server.mjs';
import { legal } from '../server/game.mjs';
import { createOpponent, opponentAction, opponentCanArm } from '../tools/human-opponent.mjs';
for (const side of [0, 1])
	for (const timeout of [false, true])
		test(`NPC side${side} first move after ${timeout ? 'expired' : 'manual'} setup respects notices with1200ms thinking`, async () => {
			let time = 1000000;
			const a = createAuthority({
				classCode: 'FIRST', teacherKey: 'fixture', now: () => time
			}), seats = [0, 1].map(() => a.call('join', {
				classCode: 'FIRST'
			}));
			a.call('teacher/start', {}, 'fixture');
			const m = [...a.matches.values()][0];
			const call = (s, r, b = {}) => a.call(r, {
				matchId: m.id, ...b
			}, seats[s].token);
			const advance = ms => {
				time += ms;
				a.tick();
			};
			const calls = [], delays = [], statuses = [];
			const command = async (action, b = {}) => {
				calls.push(action);
				return call(side, action === 'status' ? 'state' : action, {
					...b, seq: m.seq, requestId: 'npc-' + m.seq
				});
			};
			const bot = createOpponent({
				command, now: () => time, delay: async (ms) => {
					delays.push(ms);
					advance(ms);
				}, emit: s => statuses.push(s.status)
			});
			for (const s of [0, 1])
				call(s, 'setup/begin');
			call(1 - side, 'setup', {
				revision: 0
			});
			assert.equal(opponentCanArm(call(side, 'state'), m.id), false);
			if (timeout) {
				advance(300000);
				assert(m.ready.every(Boolean));
				assert.equal(opponentCanArm(call(side, 'state'), m.id), false);
				await bot.tick();
				assert.equal(statuses.at(-1), 'wait-setup-notice');
				assert(!calls.includes('select'));
				advance(2999);
				await bot.tick();
				assert(!calls.includes('select'));
				advance(1);
			}
			else
				call(side, 'setup', {
					revision: 0
				});
			assert.equal(opponentCanArm(call(side, 'state'), m.id), true);
			if (side === 1) {
				advance(2000);
				await bot.tick();
				assert.equal(statuses.at(-1), 'wait-human-turn');
				let chosen;
				for (let from = 0; from < 100 && !chosen; from++)
					for (let to = 0; to < 100 && !chosen; to++)
						if (!m.board[to] && legal(m, 0, from, to))
							chosen = {
								from, to
							};
				call(0, 'move', {
					...chosen, seq: m.seq, requestId: 'human-opening'
				});
			}
			await bot.tick();
			assert.equal(statuses.at(-1), 'wait-turn-banner');
			assert(!calls.includes('select'));
			advance(2000);
			const start = time, seq = m.seq, cpu = performance.now();
			await bot.tick();
			const cpuMs = performance.now() - cpu;
			assert.equal(m.seq, seq + 1);
			assert.equal(m.events.at(-1).side, side);
			assert.deepEqual(delays, [1200]);
			assert.equal(time - start, 1200);
			assert.equal(calls.filter(x => x === 'move').length, 1);
			console.log(JSON.stringify({
				scenario: `side${side}-${timeout ? 'timeout' : 'manual'}`, virtualThinkMs: 1200, cpuMs: Math.round(cpuMs * 100) / 100, scope: 'in-process authority, excludes mailbox/browser/network'
			}));
		});
test('driver waits through authoritative turn announcement and cannot be armed for wrong/ended round', () => {
	const s = {
		phase: 'active', match: {
			id: 'm', phase: 'play', ready: [true, true], side: 0, turn: 0, turnClock: {
				noticeRemainingMs: 3000
			}
		}
	};
	assert.equal(opponentAction(s), 'wait-timeout-notice');
	assert.equal(opponentCanArm(s, 'other'), false);
	s.phase = 'ended';
	assert.equal(opponentCanArm(s, 'm'), false);
});
test('new match clears previous cooldown and gets its own first-move pacing', async () => {
	let time = 1000000;
	const a = createAuthority({
		classCode: 'NEXT', teacherKey: 'fixture', now: () => time, timedSetup: false, timedTurns: false
	});
	const seats = [0, 1].map(() => a.call('join', {
		classCode: 'NEXT'
	}));
	let m, delays = [];
	const start = () => {
		a.call('teacher/start', {}, 'fixture');
		m = [...a.matches.values()][0];
		m.phase = 'play';
		m.ready = [true, true];
		m.board[60] = {
			id: 'npc', side: 0, rank: '4'
		};
		m.board[39] = {
			id: 'other', side: 1, rank: '4'
		};
	};
	start();
	const command = async (action, b = {}) => a.call(action === 'status' ? 'state' : action, {
		...b, seq: m.seq, requestId: 'next-' + m.seq
	}, seats[0].token);
	const bot = createOpponent({
		command, now: () => time, delay: async (ms) => {
			delays.push(ms);
			time += ms;
		}
	});
	await bot.tick();
	assert.equal(m.seq, 1);
	a.call('teacher/end', {}, 'fixture');
	start();
	await bot.tick();
	assert.equal(m.seq, 1);
	assert.deepEqual(delays, [1200, 1200]);
});
