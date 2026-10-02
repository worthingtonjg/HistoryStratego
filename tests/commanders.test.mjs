import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthority } from '../server/server.mjs';
import { COMMANDERS } from '../server/commanders.mjs';
const fixturePool = [0, 1].flatMap(side => Array.from({
	length: 24
}, (_, i) => ({
	id: `fixture-${side}-${i}`, name: `Leader ${side}-${i}`, side, role: 'Test fixture', summary: 'Not historical content.', strategy: 'Test only.', sourceTitle: 'Fixture', sourceUrl: 'https://example.test/profile'
})));
function classroom(n = 4, pool = fixturePool) {
	const a = createAuthority({
		timedSetup: false,
		teacherKey: 'teacher', classCode: 'TEST', commanderPool: pool
	});
	const players = Array.from({
		length: n
	}, () => a.call('join', {
		classCode: 'TEST', name: 'Untrusted nickname', commander: {
			id: 'injected'
		}, side: 1
	}));
	return {
		a, players
	};
}
const state = (a, p) => a.call('state', {}, p.token);
test('join immediately assigns a unique fixed leader and profile, ignores requested name and side, and does not pair', () => {
	const { a, players } = classroom();
	assert.equal(new Set(players.map(p => p.nickname)).size, 4);
	assert.deepEqual(players.map(p => p.commander.side), [0, 1, 0, 1]);
	assert(players.every(p => p.nickname === p.commander.name && p.commander.id !== 'injected' && !p.paired && p.match === null));
	assert(a.call('teacher/state', {}, 'teacher').roster.every(p => p.waiting && p.pair === 0));
	assert.throws(() => a.call('rename', {
		name: 'Arbitrary'
	}, players[0].token));
	assert.equal(state(a, players[0]).nickname, players[0].nickname);
});
test('40 arrivals balance factions without replacement; repeated randomization and token reconnect preserve identities', () => {
	const { a, players } = classroom(40);
	assert.equal(new Set(players.map(p => p.commander.id)).size, 40);
	for (let round = 0; round < 4; round++) {
		a.call('teacher/randomize', {}, 'teacher');
		const roster = a.call('teacher/state', {}, 'teacher').roster;
		roster.forEach((p, i) => assert.equal(p.side, i % 2));
		for (const p of players)
			assert.deepEqual(state(a, p).commander, p.commander);
	}
	const rejoined = a.call('join', {
		classCode: 'TEST', name: 'Changed', side: 1
	}, players[0].token);
	assert.equal(rejoined.player, players[0].player);
	assert.deepEqual(rejoined.commander, players[0].commander);
	assert.equal(a.students.size, 40);
	assert.throws(() => a.call('join', {
		classCode: 'TEST'
	}), /full/);
});
test('same-faction swaps change opponents without renaming; cross-faction swaps reject atomically; archives retain identity', () => {
	const { a, players: p } = classroom();
	a.call('teacher/start', {}, 'teacher');
	const m = [...a.matches.values()][0], names = [...m.playerNames], profiles = structuredClone(m.commanders);
	a.call('teacher/end', {}, 'teacher');
	const before = a.call('teacher/state', {}, 'teacher');
	assert.throws(() => a.call('teacher/swap', {
		a: p[0].player, b: p[1].player
	}, 'teacher'), /same faction/);
	assert.deepEqual(a.call('teacher/state', {}, 'teacher'), before);
	a.call('teacher/swap', {
		a: p[0].player, b: p[2].player
	}, 'teacher');
	for (const x of p)
		assert.deepEqual(state(a, x).commander, x.commander);
	assert.deepEqual(m.playerNames, names);
	assert.deepEqual(m.commanders, profiles);
	m.events.push({
		kind: 'combat', seq: 1, ack: [false, false], side: 0, from: 60, to: 50, attacker: '2', defender: '3', outcome: -1, text: 'Fixture combat'
	});
	a.call('teacher/start', {}, 'teacher');
	assert.deepEqual([...a.matches.values()].map(x => x.players), [[p[2].player, p[1].player], [p[0].player, p[3].player]]);
	assert.notEqual(state(a, p[0]).match.id, m.id);
	assert.deepEqual(m.playerNames, names);
	assert.deepEqual(m.commanders, profiles);
});
test('odd and late arrivals get profiles immediately but remain unpaired until teacher action', () => {
	const { a, players: p } = classroom(3);
	a.call('teacher/randomize', {}, 'teacher');
	const waiting = a.call('teacher/state', {}, 'teacher').roster.filter(p => p.waiting);
	assert.equal(waiting.length, 1);
	assert(waiting[0].commander);
	a.call('teacher/start', {}, 'teacher');
	const late = a.call('join', {
		classCode: 'TEST'
	});
	assert(late.commander);
	assert.equal(late.match, null);
	assert.equal(late.paired, false);
	assert.equal(a.matches.size, 1);
	assert.throws(() => a.call('teacher/randomize', {}, 'teacher'), /End/);
	a.call('teacher/end', {}, 'teacher');
	a.call('teacher/start', {}, 'teacher');
	assert.equal(a.matches.size, 2);
	assert.deepEqual(state(a, late).commander, late.commander);
});
test('pool exhaustion rejects join atomically without reusing aliases or crossing factions', () => {
	const { a } = classroom(2, fixturePool.filter(c => c.id.endsWith('-0')));
	const before = a.call('teacher/state', {}, 'teacher');
	assert.throws(() => a.call('join', {
		classCode: 'TEST'
	}), /No unused commander/);
	assert.deepEqual(a.call('teacher/state', {}, 'teacher'), before);
	assert.equal(a.students.size, 2);
});
test('inactive seats reserve aliases; matchmaking uses available opposite factions and reconnect preserves identity', () => {
	let clock = 1000;
	const a = createAuthority({
		timedSetup: false,
		classCode: 'TEST', teacherKey: 'teacher', commanderPool: fixturePool, now: () => clock
	});
	const p = Array.from({
		length: 4
	}, () => a.call('join', {
		classCode: 'TEST'
	}));
	clock += 90001;
	for (const i of [0, 2])
		state(a, p[i]);
	a.call('teacher/randomize', {}, 'teacher');
	assert(a.call('teacher/state', {}, 'teacher').roster.every(p => p.waiting));
	assert.throws(() => a.call('teacher/start', {}, 'teacher'), /connected Union/);
	assert.throws(() => a.call('teacher/swap', {
		a: p[1].player, b: p[3].player
	}, 'teacher'), /reconnect/);
	const late = a.call('join', {
		classCode: 'TEST'
	});
	assert.equal(late.commander.side, 1);
	assert(!p.some(x => x.commander.id === late.commander.id));
	a.call('teacher/start', {}, 'teacher');
	assert.equal(a.matches.size, 1);
	const old = state(a, p[1]);
	assert.deepEqual(old.commander, p[1].commander);
	assert.equal(old.match, null);
	a.call('teacher/end', {}, 'teacher');
	a.call('teacher/start', {}, 'teacher');
	assert.equal(a.matches.size, 2);
	assert([...a.matches.values()].every(m => m.commanders[0].side === 0 && m.commanders[1].side === 1));
});
test('sourced commander pool has 24 unique leaders per faction with profiles and primary HTTPS references', () => {
	assert.equal(COMMANDERS.length, 48);
	assert.equal(new Set(COMMANDERS.map(c => c.id)).size, 48);
	assert.equal(new Set(COMMANDERS.map(c => c.name)).size, 48);
	for (const side of [0, 1])
		assert.equal(COMMANDERS.filter(c => c.side === side).length, 24);
	for (const c of COMMANDERS) {
		for (const key of ['id', 'name', 'fullName', 'role', 'summary', 'strategy', 'description', 'sourceTitle'])
			assert(c[key]);
		assert.equal(c.faction, c.side === 0 ? 'Confederate' : 'Union');
		assert.equal(c.summary, c.profile);
		assert.equal(c.strategy, c.battleExample);
		assert(c.sourceUrls.includes(c.sourceUrl));
		for (const url of c.sourceUrls) {
			const u = new URL(url);
			assert.equal(u.protocol, 'https:');
			assert(/(^|\.)(nps|loc|archives)\.gov$/.test(u.hostname));
		}
	}
});
test('default historical pool supports a full classroom without duplicates or hidden-side inference', () => {
	const { a, players } = classroom(40, COMMANDERS);
	a.call('teacher/start', {}, 'teacher');
	const states = players.map(p => state(a, p));
	assert.equal(new Set(states.map(s => s.nickname)).size, 40);
	assert(states.every(s => s.commander.side === s.match.side));
	assert(states.every(s => s.match.phase === 'setup' && s.match.commanders[s.match.side].id === s.commander.id));
});
