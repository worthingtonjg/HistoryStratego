import { compactCode, containsCode } from './source-format-helper.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
test('actual Unity C# banter category priority, special rules, deterministic replay and no consecutive repeats', {
	skip: process.platform !== 'win32'
}, () => {
	const dir = mkdtempSync(join(tmpdir(), 'banter-'));
	try {
		const exe = join(dir, 'tests.exe');
		execFileSync(join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), ['/nologo', '/out:' + exe, resolve('Assets/Scripts/BattleBanter.cs'), resolve('Assets/Scripts/CutscenePresentation.cs'), resolve('Assets/Scripts/BattleCaption.cs'), resolve('tests/banter-vectors.cs')]);
		assert.match(execFileSync(exe, [], {
			encoding: 'utf8'
		}), /PASS:/);
	}
	finally {
		rmSync(dir, {
			recursive: true, force: true
		});
	}
});
test('cutscene retains factual labels and stable public-event replay for both players and spectator', () => {
	const s = readFileSync('Assets/Scripts/HistoryGame.cs', 'utf8');
	for (const text of ['ATTACKER | ', 'DEFENDER | ', 'Label(e.attacker)', 'Label(e.defender)', 'CutscenePresentation.Speaker', 'Banter(m,e)', 'BattleCaption.Describe(PlayerName(m,e.side)', 'BattleRole(new Rect'])
		assert(text.includes(' | ') ? s.includes(text) : containsCode(s, text));
	assert(containsCode(s, 'e.kind!="combat"||e.seq>target.seq'));
	assert(containsCode(s, 'if(e.seq==target.seq)return previous'));
	assert(containsCode(s, 'BattleBanter.Category(e.attacker,e.defender,e.outcome)=="six-seven"?quote'), 'exact override has no added quotation marks');
});
test('actual Unity motion always advances attacker before loser topples; stationary defender and immobile bombs/flags', {
	skip: process.platform !== 'win32'
}, () => {
	const dir = mkdtempSync(join(tmpdir(), 'battle-motion-'));
	try {
		const exe = join(dir, 'tests.exe');
		execFileSync(join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), ['/nologo', '/out:' + exe, resolve('Assets/Scripts/BattleMotion.cs'), resolve('tests/battle-motion-vectors.cs')]);
		assert.match(execFileSync(exe, [], {
			encoding: 'utf8'
		}), /PASS/);
		assert(containsCode(readFileSync('Assets/Scripts/TabletopBoard.cs', 'utf8'), 'BattleMotion.At(e.attacker,e.outcome,progress)'));
	}
	finally {
		rmSync(dir, {
			recursive: true, force: true
		});
	}
});
test('factual top captions name the actual winner, special result and correct possessives', {
	skip: process.platform !== 'win32'
}, () => {
	const dir = mkdtempSync(join(tmpdir(), 'battle-caption-'));
	try {
		const exe = join(dir, 'tests.exe');
		execFileSync(join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), ['/nologo', '/out:' + exe, resolve('Assets/Scripts/BattleCaption.cs'), resolve('tests/battle-caption-vectors.cs')]);
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
