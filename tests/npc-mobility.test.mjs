import test from 'node:test';
import assert from 'node:assert/strict';
import { reachableFrontier, quietMoveMobility } from '../tools/mobility-policy.mjs';
import { planDemoMoves } from '../tools/demo-policy.mjs';
const own = (rank = '4') => ({
	side: 0, rank
});
const enemy = () => ({
	side: 1, get rank() {
		throw Error('hidden rank accessed');
	}
});
function board(entries) {
	const b = Array(100).fill(null);
	for (const [i, p] of Object.entries(entries))
		b[i] = p;
	return b;
}
function mirror(b) {
	return b.map(p => !p ? null : p.side === 0 ? {
		side: 1, rank: p.rank
	} : {
		side: 0, get rank() {
			throw Error('hidden rank accessed');
		}
	}).reverse();
}
const fixture = b => ({
	id: 'mobility', side: 0, seq: 2, phase: 'play', turn: 0, board: b, events: []
});
test('enclosed friendly pocket gets a scoring penalty, not filtered; open corridor preferred on either side', () => {
	const b = board({
		85: own(), 84: own('B'), 86: own('B'), 95: own('B'), 65: own('B'), 74: own('B'), 76: own('B'), 60: own(), 20: enemy()
	});
	assert.equal(quietMoveMobility(b, 0, 85, 75).kind, 'blocked-pocket');
	assert.equal(quietMoveMobility(b, 0, 60, 50).kind, 'reachable-frontier');
	assert.equal(quietMoveMobility(mirror(b), 1, 14, 24).kind, 'blocked-pocket');
	const result = planDemoMoves(fixture(b));
	assert(result.candidates.some(c => c.from === 85 && c.to === 75), 'legal pocket move retained');
	assert.notEqual(result.candidates[0].from, 85, 'productive alternative preferred');
});
test('sideways move that frees a friendly route is rewarded', () => {
	const b = board({
		60: own(), 70: own(), 71: own('B'), 80: own('B'), 51: own('B'), 62: own('B'), 20: enemy()
	});
	assert.equal(quietMoveMobility(b, 0, 60, 61).kind, 'opens-friendly-route');
	assert.equal(quietMoveMobility(mirror(b), 1, 39, 38).kind, 'opens-friendly-route');
});
test('occupancy and lakes are never traversed; unknown enemies are interaction frontiers', () => {
	const b = board({
		60: own('2'), 30: enemy()
	});
	const seen = reachableFrontier(b, 0);
	for (const i of [30, 42, 43, 46, 47, 52, 53, 56, 57, 60])
		assert(!seen.has(i));
	const candidates = planDemoMoves(fixture(b)).candidates;
	assert(candidates.some(c => c.from === 60 && c.to === 30 && c.mobility === 'protected-action'));
	assert(!candidates.some(c => c.from === 60 && [20, 10, 0].includes(c.to)), 'scout cannot pass through enemy');
});
test('ordinary safety retreat and all-pocket fallback remain available', () => {
	const danger = board({
		60: own(), 50: enemy()
	});
	const retreat = planDemoMoves(fixture(danger)).candidates.find(c => c.from === 60 && c.to === 70);
	assert.equal(retreat.mobility, 'protected-action');
	const b = board({
		85: own(), 84: own('B'), 86: own('B'), 95: own('B'), 65: own('B'), 74: own('B'), 76: own('B')
	});
	const result = planDemoMoves(fixture(b));
	assert.equal(result.candidates.length, 1);
	assert.equal(result.candidates[0].to, 75);
	assert(result.fallback.length > 0);
});
