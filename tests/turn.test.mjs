import { compactCode, containsCode } from './source-format-helper.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
test('compiled turn transitions: both sides, setup, first turn, manual barrier, pause/resume and reload', {
	skip: process.platform !== 'win32'
}, () => {
	const dir = mkdtempSync(join(tmpdir(), 'turn-'));
	try {
		const exe = join(dir, 'test.exe');
		execFileSync(join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), ['/nologo', '/out:' + exe, resolve('Assets/Scripts/TurnNotice.cs'), resolve('tests/turn-vectors.cs')]);
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
test('turn overlay is passive, spectator suppressed, centered header replaces redundant turn row', () => {
	const s = readFileSync('Assets/Scripts/HistoryGame.cs', 'utf8');
	assert(!s.includes('Full 40-piece classroom'));
	assert(!s.includes('"Turn: "'));
	assert(containsCode(s, 'teacherMode?null:StudentMatch()'));
	assert(containsCode(s, 'motions.Count==0'));
	assert(containsCode(s, 'turnMatch.battle?.kind!="combat"'));
	assert(containsCode(s, 'receivedSeq>=turnMatch.seq'));
	const draw = s.slice(s.indexOf('void DrawTurnNotice()'), s.indexOf('void DrawTeacher()'));
	assert(!/Button|Event.current.Use|GUI.enabled/.test(draw));
	assert(containsCode(s, 'DrawMatchHeader(m,spectator.phase)'));
	assert(containsCode(s, 'DrawMatchHeader(m,state.phase)'));
});
test('sidebar retains all public dispatches in a scrollable tab and facts retain source links and automatic rotation', () => {
	const s = readFileSync('Assets/Scripts/HistoryGame.cs', 'utf8'), panel = s.slice(s.indexOf('void DrawSidebar('), s.indexOf('void LoadDismissal('));
	assert(containsCode(panel, 'foreach(var e in events)'));
	assert(panel.includes('GUI.BeginScrollView'));
	assert(!panel.includes('m.events.Length-'));
	assert(containsCode(s, 'int sidebarTab;'));
	assert(containsCode(s, 'Application.OpenURL(f.url)'));
	assert(!s.includes('factPaused'));
	assert(containsCode(s, 'Time.unscaledTime > nextFact'));
	assert(s.includes('sourceStyle'));
	assert(containsCode(s, 'NextFact();nextFact='));
});
