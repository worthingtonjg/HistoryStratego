import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
test('compiled UI gate distinguishes read-only refreshes from serialized actions', () => {
	const d = mkdtempSync(join(tmpdir(), 'history-poll-gate-')), exe = join(d, 'gate.exe');
	try {
		execFileSync(join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), ['/nologo', '/out:' + exe, resolve('Assets/Scripts/PollActionGate.cs'), resolve('tests/poll-action-gate-vectors.cs')]);
		assert(execFileSync(exe, {
			encoding: 'utf8'
		}).includes('PASS'));
	}
	finally {
		rmSync(d, {
			recursive: true, force: true
		});
	}
});
test('setup and messages use action-only gating with revalidation; notification is passive', () => {
	const s = readFileSync('Assets/Scripts/HistoryGame.cs', 'utf8');
	assert(s.includes('m.setup.revision == action.command.revision'));
	assert(s.includes('GUI.enabled = enabled && !ActionBusy'));
	assert(s.includes('if (ActionBusy)'));
	const notification = s.split('void DrawPresetNotification')[1].split('void DrawPresetMenu')[0];
	assert(!notification.includes('Event.current.Use'));
	assert(!notification.includes('GUI.Button'));
	assert(notification.includes('commander.fullName'));
	assert(notification.includes('CommanderPortrait(commander.id)'));
	assert(notification.includes('DeadlineBlocked(m)'));
});
