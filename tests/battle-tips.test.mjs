import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { containsCode } from './source-format-helper.mjs';
test('compiled contextual tip discoveries, queue, readable duration and per-match persisted lifecycle', {
	skip: process.platform !== 'win32'
}, () => {
	const dir = mkdtempSync(join(tmpdir(), 'battle-tips-'));
	try {
		const exe = join(dir, 'tests.exe');
		execFileSync(join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), ['/nologo', '/out:' + exe, resolve('Assets/Scripts/BattleTips.cs'), resolve('Assets/Scripts/CombatClickGate.cs'), resolve('tests/battle-tips-vectors.cs')]);
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
test('tutorial integration is own-player combat-only, spectator gated, nonblocking and always on', () => {
	const s = readFileSync('Assets/Scripts/HistoryGame.cs', 'utf8');
	assert(containsCode(s, 'if(teacherMode||m==null||state==null||string.IsNullOrEmpty(state.player))return;'));
	assert(containsCode(s, 'battleTips.Observe(m.side,e.kind,e.side,e.attacker,e.defender,e.outcome)'));
	const draw = s.slice(s.indexOf('void DrawTutorialTip()'), s.indexOf('void DrawTurnReminder()'));
	assert(!/GUI.Button|Event.current.Use|Send\(/.test(draw));
	assert(s.includes('Capture the Flag to Win!'));
	assert(containsCode(s, 'if(!HandleTipInput())HandleCombatInput()'));
	assert(containsCode(s, 'visible&&paintedTip==key'));
	assert(containsCode(s, 'battleTips.Dismiss();PersistTutorialTips(m)'));
	const input = s.slice(s.indexOf('bool HandleTipInput()'), s.indexOf('void DrawTutorialTip()'));
	assert(input.includes('input.Use()'));
	assert(!/Send\(/.test(input), 'tip dismissal sends no gameplay or ack actions');
	assert(containsCode(s, '!m.blocked&&m.battle?.kind!="combat"'));
	assert(containsCode(s, 'Time.unscaledTime-turnNoticeStart>=2'));
});
