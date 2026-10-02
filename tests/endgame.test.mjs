import { compactCode, containsCode } from './source-format-helper.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { createMatch, move, view, acknowledge } from '../server/game.mjs';
import { createAuthority } from '../server/server.mjs';
const p = (side, rank) => ({
	side, rank, id: side + rank
});
test('flag and equal-rank elimination ending the game retain both final acknowledgments and forbid further moves', () => {
	for (const [a, d, reason] of [['2', 'F', 'flag'], ['4', '4', 'no legal']]) {
		const m = createMatch(['red', 'blue']);
		m.phase = 'play';
		m.board[60] = p(0, a);
		m.board[50] = p(1, d);
		m.board[99] = p(0, '2');
		m.board[0] = p(1, 'F');
		move(m, 0, 60, 50, 0, 'final');
		assert.equal(m.phase, 'over');
		assert.equal(m.winner, 0);
		for (const side of [0, 1])
			assert(view(m, side).battle);
		if (reason === 'no legal')
			assert.equal(m.events.at(-1).text, 'No legal moves remain.');
		acknowledge(m, 0, 1);
		assert(view(m, 0).battle);
		acknowledge(m, 1, 1);
		assert.equal(view(m, 0).battle, null);
		assert.equal(view(m, 1).battle, null);
		assert.throws(() => move(m, 1, 0, 10, m.seq, 'after'));
	}
});
test('teacher-ended game has no invented winner; completed roster remains eligible for next assignment', () => {
	const a = createAuthority({
		timedSetup: false,
		classCode: 'END', teacherKey: 'test'
	}), r = a.call('join', {
		classCode: 'END', name: 'Alex'
	}), b = a.call('join', {
		classCode: 'END', name: 'Sam'
	});
	a.call('teacher/start', {}, 'test');
	const m = [...a.matches.values()][0];
	a.call('teacher/end', {}, 'test');
	assert.equal(a.call('state', {}, r.token).match, null);
	assert.equal(m.winner, -1);
	assert.equal(a.call('teacher/state', {}, 'test').matches.length, 0);
	a.call('teacher/start', {}, 'test');
	for (const t of [r.token, b.token]) {
		const s = a.call('state', {}, t);
		assert.notEqual(s.match.id, m.id);
		assert.equal(s.match.phase, 'setup');
	}
	assert.equal(a.students.size, 2);
});
test('actual WebGL dismissal bridge persists per seat across reload without clearing identity or another seat', () => {
	const storage = new Map([['studentToken', 'identity']]);
	function bridge() {
		const c = {
			LibraryManager: {
				library: {}
			}, mergeInto: (o, v) => Object.assign(o, v), UTF8ToString: v => v, stringToNewUTF8: v => v, sessionStorage: {
				getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v)
			}
		};
		vm.runInNewContext(readFileSync('Assets/Plugins/WebGL/HistoryBridge.jslib', 'utf8'), c);
		return c.LibraryManager.library;
	}
	let b = bridge();
	b.HS_SaveDismissed('red-id', 'old-match');
	assert.equal(b.HS_LoadDismissed('blue-id'), '');
	assert.equal(b.HS_LoadToken(), 'identity');
	b = bridge();
	assert.equal(b.HS_LoadDismissed('red-id'), 'old-match');
	b.HS_SaveDismissed('blue-id', 'other-match');
	assert.equal(b.HS_LoadDismissed('red-id'), 'old-match');
});
test('compiled Unity endgame presentation guards final reveal/animation, exact results and next-round eligibility', {
	skip: process.platform !== 'win32'
}, () => {
	const dir = mkdtempSync(join(tmpdir(), 'endgame-'));
	try {
		const exe = join(dir, 'tests.exe');
		execFileSync(join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), ['/nologo', '/out:' + exe, resolve('Assets/Scripts/EndgamePresentation.cs'), resolve('tests/endgame-vectors.cs')]);
		assert.match(execFileSync(exe, [], {
			encoding: 'utf8'
		}), /PASS/);
	}
	finally {
		rmSync(dir, {
			recursive: true, force: true
		});
	}
});
test('completed winner/events survive archive while teacher swap creates genuinely new opponents', () => {
	const a = createAuthority({
		timedSetup: false,
		classCode: 'END', teacherKey: 'test'
	}), players = ['Alex', 'Sam', 'Charlie', 'Dana'].map(name => a.call('join', {
		classCode: 'END', name
	}));
	a.call('teacher/start', {}, 'test');
	const m = [...a.matches.values()][0];
	m.phase = 'play';
	m.board[60] = p(0, '2');
	m.board[50] = p(1, 'F');
	a.call('move', {
		from: 60, to: 50, seq: 0, requestId: 'flag'
	}, players[0].token);
	for (const x of players.slice(0, 2))
		a.call('ack', {
			matchId: m.id, seq: 1
		}, x.token);
	const events = JSON.stringify(m.events);
	a.call('teacher/end', {}, 'test');
	a.call('teacher/swap', {
		a: players[1].player, b: players[3].player
	}, 'test');
	a.call('teacher/start', {}, 'test');
	assert(m.archived);
	assert.equal(m.winner, 0);
	assert.equal(JSON.stringify(m.events), events);
	assert.deepEqual(a.call('state', {}, players[0].token).match.playerNames, [players[0], players[3]].map(p => a.call('state', {}, p.token).nickname));
	assert.deepEqual(a.call('state', {}, players[1].token).match.playerNames, [players[2], players[1]].map(p => a.call('state', {}, p.token).nickname));
	assert.notEqual(a.call('state', {}, players[0].token).match.id, m.id);
});
test('terminal board cannot consume the result-screen button click', () => {
	assert(containsCode(readFileSync('Assets/Scripts/HistoryGame.cs', 'utf8'), 'if(!commanderOpen&&!readOnly&&!EndgamePresentation.Terminal(m.phase,state.phase)&&motion==null'));
});
test('leaving teacher spectator suppresses stale in-flight result overlays on the desk', () => {
	assert(containsCode(readFileSync('Assets/Scripts/HistoryGame.cs', 'utf8'), 'teacherMode?(watchId!=""?spectator?.match:null):StudentMatch()'));
});
test('only Bombs and Flag remaining loses by no legal moves, with final combat retained until both acknowledgments', () => {
	const m = createMatch(['a', 'b']);
	m.phase = 'play';
	m.ready = [true, true];
	m.board.fill(null);
	for (const [i, side, rank] of [[60, 0, '5'], [50, 1, '4'], [99, 0, 'F'], [0, 1, 'F'], [1, 1, 'B'], [10, 1, 'B']])
		m.board[i] = {
			id: String(i), side, rank
		};
	move(m, 0, 60, 50, 0, 'last-mobile-piece');
	assert.equal(m.phase, 'over');
	assert.equal(m.winner, 0);
	assert(m.board.filter(p => p?.side === 1).every(p => ['B', 'F'].includes(p.rank)));
	assert.equal(m.events.at(-1).text, 'No legal moves remain.');
	assert(m.reveal);
	acknowledge(m, 0, 1);
	assert(m.reveal);
	acknowledge(m, 1, 1);
	assert.equal(m.reveal, null);
});
