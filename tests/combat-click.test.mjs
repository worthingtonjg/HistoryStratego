import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { containsCode } from './source-format-helper.mjs';
test('compiled combat gesture requires its own eligible press/release and never auto-retries', {
	skip: process.platform !== 'win32'
}, () => {
	const dir = mkdtempSync(join(tmpdir(), 'combat-click-'));
	try {
		const exe = join(dir, 'test.exe');
		execFileSync(join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), ['/nologo', '/out:' + exe, resolve('Assets/Scripts/CombatClickGate.cs'), resolve('tests/combat-click-vectors.cs')]);
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
test('combat input runs before controls, queues only explicit gestures and shields dismissal tails', () => {
	const s = readFileSync('Assets/Scripts/HistoryGame.cs', 'utf8');
	assert(s.indexOf('HandleCombatInput();') < s.indexOf('GUI.skin.label.fontSize'));
	assert(containsCode(s, 'var m = teacherMode ? null : StudentMatch();'));
	assert(containsCode(s, 'Time.unscaledTime - battleStart >= 2.3f && !battle.ack[m.side]'));
	assert(containsCode(s, 'if(pendingCombatAck != null && !busy)'));
	assert(containsCode(s, 'combatDismissUntil = Time.unscaledTime + .65f'));
	assert(s.includes('input.Use();'));
	assert(!s.includes('"Continue"'));
	assert(s.includes('Click the battle panel to continue'));
});
test('dispatch tab opens only once per match after both setups and never on first lock', () => {
	const s = readFileSync('Assets/Scripts/HistoryGame.cs', 'utf8');
	assert(containsCode(s, 'm.phase == "play" && m.ready != null && m.ready.Length == 2 && m.ready[0] && m.ready[1] && dispatchStarted.Add(m.id)'));
});

test('battle rectangles stay in board bounds and outside clicks do not acknowledge', () => {
 const s=readFileSync('Assets/Scripts/HistoryGame.cs','utf8');
 const draw=s.split('void DrawBattle(')[1].split('void SyncPresence(')[0];
 assert(draw.includes('GUI.BeginGroup(boardRect)'));assert(draw.includes('GUI.EndGroup()'));
 for(const r of draw.matchAll(/new Rect\((\d+), (\d+), (\d+), (\d+)\)/g)) {const [x,y,w,h]=r.slice(1).map(Number);assert(x+w<=865&&y+h<=555);}
 const input=s.split('void HandleCombatInput()')[1].split('void DrawBattle(')[0];assert(input.includes('boardRect.Contains'));assert(input.includes('if (!inside)'));assert(input.indexOf('if (!inside)')<input.lastIndexOf('input.Use()'));
});