import { compactCode, containsCode } from './source-format-helper.mjs';
import { createAuthority } from '../server/server.mjs';
import { generateFormation } from '../web/formation.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
test('compiled cutscene attribution distinguishes winning speakers from bomb/tie/narrator lines', {
	skip: process.platform !== 'win32'
}, () => {
	const dir = mkdtempSync(join(tmpdir(), 'cutscene-'));
	try {
		const exe = join(dir, 'tests.exe');
		execFileSync(join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), ['/nologo', '/out:' + exe, resolve('Assets/Scripts/BattleCaption.cs'), resolve('Assets/Scripts/CutscenePresentation.cs'), resolve('tests/cutscene-vectors.cs')]);
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
test('spectator has only observation/navigation; players retain manual Continue and spectators cannot acknowledge', () => {
	const s = readFileSync('Assets/Scripts/HistoryGame.cs', 'utf8');
	for (const gone of ['COMBAT REVEAL - both players', 'TABLETOP BANTER:', 'Red acknowledged:', 'AutoAcknowledge', 'CombatReadingTimer'])
		assert(!s.includes(gone));
	const spectator = s.slice(s.indexOf('void DrawSpectator()'), s.indexOf('void DrawStudent()'));
	for (const route of ['teacher/pause', 'teacher/resume', 'teacher/end', 'teacher/release-reveal'])
		assert(!spectator.includes(route));
	assert(spectator.includes('Back to teacher desk'));
	assert(spectator.includes('Switch perspectives'));
	assert(containsCode(s, 'if (!readOnly && (e.ack[m.side] || elapsed >= 2.3f))'));
	assert(containsCode(s, 'var m = teacherMode ? null : StudentMatch();'));
	assert(s.includes('Click the battle panel to continue'));
	assert(!containsCode(s, 'Button(375,655,450,"Continue")'));
	assert(containsCode(s, 'Label(e.attacker),e.side'));
	assert(containsCode(s, 'Label(e.defender),1-e.side'));
});
test('teacher desk class-wide Pause/Resume/End governs two active matches without fabricating winners', () => {
	const a = createAuthority({
		timedSetup: false,
		classCode: 'FOUR', teacherKey: 'teacher'
	}), p = ['A', 'B', 'C', 'D'].map(name => a.call('join', {
		classCode: 'FOUR', name
	}));
	a.call('teacher/start', {}, 'teacher');
	p.forEach((player, i) => a.call('setup', {
		ranks: generateFormation(100 + i)
	}, player.token));
	a.call('teacher/pause', {}, 'teacher');
	for (const player of p) {
		const s = a.call('state', {}, player.token);
		assert.equal(s.phase, 'paused');
		assert.equal(s.match.phase, 'play');
		assert.throws(() => a.call('select', {
			from: 60, seq: s.match?.seq ?? 0
		}, player.token), /not enabled/);
	}
	a.call('teacher/resume', {}, 'teacher');
	for (const i of [0, 2]) {
		const s = a.call('state', {}, p[i].token), from = s.match.board.findIndex((x, n) => x?.side === 0 && x.rank === '2' && n >= 60 && n < 70);
		a.call('select', {
			from, seq: s.match.seq
		}, p[i].token);
	}
	const endedMatches = [...a.matches.values()];
	a.call('teacher/end', {}, 'teacher');
	assert(endedMatches.every(m => m.winner === -1));
	for (const player of p) {
		const s = a.call('state', {}, player.token);
		assert.equal(s.phase, 'ended');
		assert.equal(s.match, null);
		assert.throws(() => a.call('select', {
			from: 60, seq: s.match?.seq ?? 0
		}, player.token), /not enabled/);
	}
});
