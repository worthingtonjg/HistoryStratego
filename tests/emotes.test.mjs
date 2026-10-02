import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthority } from '../server/server.mjs';
import { army } from '../server/game.mjs';
function fixture() {
	let time = 100000;
	const a = createAuthority({
		teacherKey: 'teacher', classCode: 'TEST', now: () => time, timedSetup: false, timedTurns: false
	});
	const p = [a.call('join', {
		classCode: 'TEST'
	}), a.call('join', {
		classCode: 'TEST'
	})];
	a.call('teacher/start', {}, 'teacher');
	for (const x of p)
		a.call('setup', {
			ranks: army()
		}, x.token);
	return {
		a, p, m: [...a.matches.values()][0], advance: ms => time += ms
	};
}
test('preset messages are validated, authenticated, cooldown limited and do not mutate gameplay', () => {
	const { a, p, m, advance } = fixture(), before = JSON.stringify(m);
	const body = {
		matchId: m.id, emoteId: 'well_played'
	};
	assert.throws(() => a.call('emote', body, 'teacher'));
	assert.throws(() => a.call('emote', {
		...body, emoteId: 'custom text'
	}, p[0].token), /preset/);
	const response = a.call('emote', body, p[0].token);
	assert.equal(response.match.emotes[0].text, 'Well played!');
	assert.equal(response.match.emoteCooldownMs, 10000);
	assert.equal(JSON.stringify(m), before);
	assert.throws(() => a.call('emote', body, p[0].token), /Wait/);
	advance(9999);
	assert.throws(() => a.call('emote', body, p[0].token), /Wait/);
	advance(1);
	assert.equal(a.call('emote', body, p[0].token).match.emotes.length, 1);
});
test('both players and read-only spectator receive bounded public messages without ranks', () => {
	const { a, p, m, advance } = fixture();
	a.call('emote', {
		matchId: m.id, emoteId: 'greeting'
	}, p[0].token);
	a.call('emote', {
		matchId: m.id, emoteId: 'bold'
	}, p[1].token);
	const other = a.call('state', {}, p[1].token), watch = a.call('teacher/spectate', {
		matchId: m.id
	}, 'teacher');
	assert.deepEqual(watch.match.emotes, other.match.emotes);
	assert.equal(watch.match.emotes.length, 2);
	assert.deepEqual(Object.keys(watch.match.emotes[0]).sort(), ['issuedAt', 'remainingMs', 'side', 'text']);
	assert(other.match.board.filter(x => x?.side === 0).every(x => x.rank === '?'));
	advance(4000);
	assert.equal(a.call('state', {}, p[0].token).match.emotes.length, 0);
});
test('wrong match, pause, setup and combat reject messages; spectators cannot impersonate a player', () => {
	const { a, p, m } = fixture();
	const body = {
		matchId: m.id, emoteId: 'trap'
	};
	assert.throws(() => a.call('emote', {
		...body, matchId: 'other'
	}, p[0].token));
	a.call('teacher/pause', {}, 'teacher');
	assert.throws(() => a.call('emote', body, p[0].token));
	a.call('teacher/resume', {}, 'teacher');
	m.phase = 'setup';
	assert.throws(() => a.call('emote', body, p[0].token));
	m.phase = 'play';
	m.reveal = {};
	assert.throws(() => a.call('emote', body, p[0].token));
	assert.throws(() => a.call('teacher/emote', body, 'teacher'));
});
import { createAuthority as createBrowserAuthority } from '../browser/engine/authority.mjs';
test('browser authority preserves cooldown through checkpoint recovery', () => {
	const a = createBrowserAuthority({
		teacherKey: 'teacher', classCode: 'TEST', now: () => 100000, timedSetup: false, timedTurns: false
	});
	const p = [a.call('join', {
		classCode: 'TEST'
	}), a.call('join', {
		classCode: 'TEST'
	})];
	a.call('teacher/start', {}, 'teacher');
	for (const x of p)
		a.call('setup', {
			ranks: army()
		}, x.token);
	const m = [...a.matches.values()][0];
	a.call('emote', {
		matchId: m.id, emoteId: 'good_game'
	}, p[0].token);
	const b = createBrowserAuthority({
		teacherKey: 'teacher', classCode: 'TEST', snapshot: a.exportSnapshot(), now: () => 101000, timedSetup: false, timedTurns: false
	});
	assert.throws(() => b.call('emote', {
		matchId: m.id, emoteId: 'good_game'
	}, p[0].token), /Wait/);
	assert.equal(b.call('state', {}, p[1].token).match.emotes[0].text, 'Good game!');
});
test('sending a message does not advance an eligible running turn clock', () => {
	let now = 100000;
	const a = createAuthority({
		teacherKey: 'teacher', classCode: 'TEST', now: () => now, timedSetup: false, timedTurns: true
	});
	const p = [a.call('join', {
		classCode: 'TEST'
	}), a.call('join', {
		classCode: 'TEST'
	})];
	a.call('teacher/start', {}, 'teacher');
	for (const x of p)
		a.call('setup', {
			ranks: army()
		}, x.token);
	a.tick();
	const m = [...a.matches.values()][0], before = JSON.stringify(m);
	now += 5000;
	a.call('emote', {
		matchId: m.id, emoteId: 'bold'
	}, p[0].token);
	assert.equal(JSON.stringify(m), before);
});
