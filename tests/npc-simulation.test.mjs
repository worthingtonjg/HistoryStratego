import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createMatch, setup, view, legal, move, acknowledge } from '../server/game.mjs';
import { generateFormation } from '../web/formation.mjs';
import { planDemoMoves } from '../tools/demo-policy.mjs';
test('seeded full-army simulations make legal public-view progress across reconnects without hidden-rank reads', () => {
	const results = [];
	for (let seed = 1; seed <= 8; seed++) {
		const m = createMatch(['a', 'b']);
		setup(m, 0, generateFormation(seed * 2));
		setup(m, 1, generateFormation(seed * 2 + 1));
		const memories = [null, null];
		let fallbacks = 0, homeBlocked = 0, combats = 0, turns = 0;
		for (; turns < 350 && m.phase === 'play'; turns++) {
			const side = m.turn, v = view(m, side);
			for (const p of v.board)
				if (p && p.side !== side)
					Object.defineProperty(p, 'rank', {
						get() {
							throw Error('Hidden rank read in simulation');
						}
					});
			const p = planDemoMoves(v, memories[side]);
			memories[side] = JSON.parse(JSON.stringify(p.memory));
			let chosen = p.candidates.find(c => legal(m, side, c.from, c.to));
			if (!chosen) {
				chosen = p.fallback.find(c => legal(m, side, c.from, c.to));
				if (chosen)
					fallbacks++;
			}
			if (!chosen) {
				chosen = p.emergency.find(c => legal(m, side, c.from, c.to));
				if (chosen)
					assert(!p.fallback.some(c => legal(m, side, c.from, c.to)), 'home exception requires actual legal necessity');
			}
			if (!chosen) {
				homeBlocked++;
				break;
			}
			const rank = v.board[chosen.from].rank;
			if (['1', '3'].includes(rank)) {
				const mission = rank === '1' ? p.memory.spyTarget : p.memory.assignment && p.memory.miners[p.memory.assignment.minerId] === chosen.from;
				const home = i => side === 0 ? i >= 50 : i < 50;
				assert(chosen.reason === 'forced-home-crossing' || mission || !home(chosen.from) || home(chosen.to), 'idle special piece must not cross from home');
			}
			const target = m.board[chosen.to];
			move(m, side, chosen.from, chosen.to, m.seq, 'simulation-' + seed + '-' + turns);
			if (target)
				combats++;
			if (m.reveal) {
				const seq = m.reveal.seq;
				acknowledge(m, 0, seq);
				acknowledge(m, 1, seq);
			}
		}
		results.push({
			seed, turns, combats, fallbacks, homeBlocked, phase: m.phase
		});
		assert.equal(homeBlocked, 0, 'unexpected policy stop, seed ' + seed);
		assert(combats >= 8, 'simulation must engage rather than hover, seed ' + seed);
	}
	if (process.env.NPC_EVIDENCE)
		writeFileSync(process.env.NPC_EVIDENCE, JSON.stringify({
			result: 'passed', results
		}, null, 2));
	console.log('NPC simulations: ' + JSON.stringify(results));
});
