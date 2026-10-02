import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { containsCode } from './source-format-helper.mjs';
const source = readFileSync('Assets/Scripts/HistoryGame.cs', 'utf8');
test('Unity deadlines are server projections and block overlapping gameplay prompts', () => {
	assert(source.includes('public TurnClockView turnClock;'));
	const draw = source.slice(source.indexOf('void DrawDeadlineNotice'), source.indexOf('bool NeedsIntro'));
	assert(!/Send\(|GUI.Button|setup\/|\/move/.test(draw), 'notice never initiates a game action');
	assert(source.includes('DrawDeadlineNotice(current);'));
	assert(source.includes('!DeadlineBlocked(turnMatch)'));
	assert(source.includes('!DeadlineBlocked(m)'));
	assert(source.includes('turnMatch.turnClock.remainingMs <= 15000'));
});
test('teacher pause stops automatic combat timing without disarming manual Continue', () => {
	const automatic = source.slice(source.indexOf('void UpdateAutomaticContinue()'), source.indexOf('void HandleCombatInput()'));
	assert(containsCode(automatic, 'bool eligible=manualReady&&state.phase=="active"'));
	assert(containsCode(automatic, 'combatClick.Observe(key,manualReady)'));
	assert(containsCode(automatic, 'revealTiming.Observe(key,eligible,readableSeconds)'));
});
test('sample importer preserves supplied alpha without changing source images', () => {
	const s = readFileSync('Assets/Editor/PieceArtImport.cs', 'utf8');
	assert(s.includes('TextureImporterAlphaSource.FromInput'));
	assert(s.includes('TextureImporterFormat.RGBA32'));
	assert(s.includes('alphaIsTransparency = true'));
});
