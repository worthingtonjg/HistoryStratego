import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthority } from '../server/server.mjs';
import { view } from '../server/game.mjs';
function fixture(final = false) {
	let time = 1000;
	const a = createAuthority({
		classCode: 'BG', teacherKey: 'teacher', now: () => time, timedSetup: false, timedTurns: false
	});
	const p = [0, 1].map(() => a.call('join', {
		classCode: 'BG'
	}));
	a.call('teacher/start', {}, 'teacher');
	const m = [...a.matches.values()][0];
	m.phase = 'play';
	m.ready = [true, true];
	m.board.fill(null);
	for (const [i, side, rank] of [[60, 0, '4'], [50, 1, final ? 'F' : '2'], [99, 0, 'F'], [0, 1, 'F'], [1, 1, '2']])
		m.board[i] = {
			id: String(i), side, rank
		};
	const call = (side, route, b = {}) => a.call(route, {
		matchId: m.id, seq: m.seq, ...b
	}, p[side].token);
	call(0, 'move', {
		from: 60, to: 50, requestId: 'fight'
	});
	return {
		a, p, m, call, advance: ms => {
			time += ms;
			a.tick();
		}
	};
}
test('server auto-continue needs own rendered-ready opt-in; elapsed sleep progresses without client polls', () => {
	const f = fixture();
	f.advance(20000);
	assert.deepEqual(f.m.reveal.ack, [false, false]);
	f.call(0, 'battle/ready');
	f.advance(4999);
	assert(!f.m.reveal.ack[0]);
	f.call(0, 'battle/ready');
	f.advance(1);
	assert(f.m.reveal.ack[0]);
	assert(!f.m.reveal.ack[1]);
	assert.equal(f.call(0, 'state').match.battleContinue.armed, false);
	assert(!JSON.stringify(view(f.m, 1)).includes('continueClocks'));
});
test('teacher pause excluded, retries do not restart five seconds, manual ack race idempotent', () => {
	const f = fixture();
	f.call(0, 'battle/ready');
	f.advance(2000);
	f.a.call('teacher/pause', {}, 'teacher');
	f.advance(60000);
	assert.equal(f.call(0, 'state').match.battleContinue.remainingMs, 3000);
	f.call(0, 'battle/ready');
	f.a.call('teacher/resume', {}, 'teacher');
	f.advance(2999);
	assert(!f.m.reveal.ack[0]);
	f.call(0, 'ack');
	f.advance(1);
	f.call(0, 'ack');
	assert(f.m.reveal.ack[0]);
});
test('teacher and unrelated student cannot schedule another player; ended round cannot revive', () => {
	const f = fixture();
	assert.throws(() => f.a.call('battle/ready', {
		matchId: f.m.id, seq: f.m.seq
	}, 'teacher'), /Join/);
	const stranger = f.a.call('join', {
		classCode: 'BG'
	});
	assert.throws(() => f.a.call('battle/ready', {
		matchId: f.m.id, seq: f.m.seq
	}, stranger.token), /Current match/);
	f.call(0, 'battle/ready', {
		side: 1
	});
	f.advance(5000);
	assert(f.m.reveal.ack[0] && !f.m.reveal.ack[1]);
	f.call(1, 'battle/ready');
	f.a.call('teacher/end', {}, 'teacher');
	f.advance(60000);
	assert(!f.m.reveal.ack[1]);
	assert.throws(() => f.call(1, 'battle/ready'), /Current match/);
});
test('final capture holds result barrier until both independently scheduled acknowledgments finish', () => {
	const f = fixture(true);
	assert.equal(f.m.phase, 'over');
	f.call(0, 'battle/ready');
	f.advance(5000);
	assert(f.m.reveal);
	f.call(1, 'battle/ready');
	f.advance(5000);
	assert.equal(f.m.reveal, null);
	assert.equal(f.m.winner, 0);
});
