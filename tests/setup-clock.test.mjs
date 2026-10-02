import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthority } from '../server/server.mjs';
function fixture() {
	let time = 1000000;
	const a = createAuthority({
		classCode: 'CLOCK', teacherKey: 'teacher', now: () => time
	});
	const p = [a.call('join', {
		classCode: 'CLOCK'
	}), a.call('join', {
		classCode: 'CLOCK'
	})];
	a.call('teacher/start', {}, 'teacher');
	const id = a.call('state', {}, p[0].token).match.id;
	const call = (side, route, body = {}) => a.call(route, {
		matchId: id, ...body
	}, p[side].token);
	return {
		a, p, id, call, advance: ms => time += ms, now: () => time
	};
}
test('intro starts only the caller clock; repeat/reload cannot extend it or leak the opposing draft', () => {
	const f = fixture();
	const before = f.call(0, 'state').match.setup;
	assert.equal(before.started, false);
	assert.equal(before.draft.length, 40);
	f.advance(300000);
	assert.equal(f.call(0, 'state').match.setup.remainingMs, 300000);
	let s = f.call(0, 'setup/begin', {
		side: 1, deadline: Infinity, serverNow: 0
	});
	const deadline = s.match.setup.deadline;
	assert.equal(f.call(1, 'state').match.setup.started, false);
	f.advance(1234);
	assert.equal(f.call(0, 'setup/begin').match.setup.deadline, deadline);
	assert.equal(f.a.call('join', {
		classCode: 'CLOCK'
	}, f.p[0].token).match.setup.remainingMs, 298766);
	assert.equal(s.match.board.filter(Boolean).length, 0);
	assert.equal(s.match.setupClocks, undefined);
	assert.throws(() => f.a.call('setup/begin', {
		matchId: f.id
	}, 'teacher'), /Join/);
	assert.throws(() => f.call(1, 'setup/begin', {
		matchId: 'other'
	}), /different round/);
	assert.throws(() => f.call(1, 'setup', {
		revision: 0
	}), /Start game/);
	const spectator = f.a.call('teacher/spectate', {
		matchId: f.id
	}, 'teacher');
	assert.equal(spectator.match.setup, undefined);
});
test('deadline locks the last server-confirmed legal draft even disconnected; late swap/manual lock cannot replace it', () => {
	const f = fixture();
	const draft = f.call(0, 'setup/begin').match.setup.draft;
	const s = f.call(0, 'setup/swap', {
		from: draft.indexOf('F'), to: 0, revision: 0
	});
	const expected = [...draft];
	const flag=expected.indexOf('F');[expected[0], expected[flag]] = [expected[flag], expected[0]];
	assert.deepEqual(s.match.setup.draft, expected);
	assert.equal(s.match.setup.revision, 1);
	assert.throws(() => f.call(0, 'setup/swap', {
		from: 0, to: 40, revision: 1
	}), /different formation/);
	assert.throws(() => f.call(0, 'setup/shuffle', {
		revision: 0
	}), /changed/);
	f.advance(300000);
	f.a.tick();
	const after = f.call(0, 'state');
	assert.equal(after.match.ready[0], true);
	assert.equal(after.match.setup.automatic, true);
	assert.equal(after.match.phase, 'setup');
	assert.equal(after.match.board[60].rank,'F');assert.equal(after.match.board.slice(60).filter(Boolean).length,40);
	assert.throws(() => f.call(0, 'setup/swap', {
		from: 0, to: 1, revision: 1
	}), /locked/);
	assert.equal(f.call(0, 'setup', {
		revision: 1, ranks: []
	}).match.seq, 1);
	f.a.tick();
	assert.equal(f.call(0, 'state').match.seq, 1);
});
test('independent starts, early lock and simultaneous timeout enter play once', () => {
	const f = fixture();
	f.call(0, 'setup/begin');
	f.advance(20000);
	f.call(1, 'setup/begin');
	f.advance(280000);
	let s = f.call(1, 'state');
	assert.deepEqual(s.match.ready, [true, false]);
	assert.equal(s.match.setup.remainingMs, 20000);
	f.call(1,'setup/next',{revision:0});f.call(1,'setup/next',{revision:1});
	f.call(1, 'setup', {
		revision: 2
	});
	s = f.call(1, 'state');
	assert.equal(s.match.phase, 'play');
	assert.equal(s.match.seq, 2);
	assert.equal(s.match.board.filter(Boolean).length, 80);
	f.advance(300000);
	f.a.tick();
	assert.equal(f.call(0, 'state').match.seq, 2);
	const g = fixture();
	g.call(0, 'setup/begin');
	g.call(1, 'setup/begin');
	g.advance(300000);
	g.a.tick();
	assert.equal(g.call(0, 'state').match.phase, 'play');
	assert.equal(g.call(0, 'state').match.seq, 2);
});
test('pause freezes countdown, resume retains remaining time, end cancels and a new round gets fresh intro', () => {
	const f = fixture();
	f.call(0, 'setup/begin');
	f.advance(10000);
	f.a.call('teacher/pause', {}, 'teacher');
	const frozen = f.call(0, 'state').match.setup;
	assert.equal(frozen.remainingMs, 290000);
	f.advance(3300000);
	assert.equal(f.call(0, 'state').match.setup.remainingMs, 290000);
	assert.throws(() => f.call(0, 'setup/shuffle', {
		revision: 0
	}), /not enabled/);
	assert.throws(() => f.call(1, 'setup/begin'), /not enabled/);
	f.a.call('teacher/resume', {}, 'teacher');
	assert.equal(f.call(0, 'state').match.setup.deadline, f.now() + 290000);
	f.advance(289999);
	assert.equal(f.call(0, 'state').match.ready[0], false);
	f.a.call('teacher/end', {}, 'teacher');
	f.advance(300000);
	f.a.tick();
	assert.equal(f.call(0, 'state').match, null);
	assert.throws(() => f.call(0, 'setup/begin'), /not enabled/);
	f.call(1, 'state');
	f.a.call('teacher/start', {}, 'teacher');
	const fresh = f.call(0, 'state');
	assert.notEqual(fresh.match.id, f.id);
	assert.equal(fresh.match.setup.started, false);
	assert.equal(fresh.match.setup.remainingMs, 300000);
});
