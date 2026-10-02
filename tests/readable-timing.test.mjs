import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
test('compiled readable clocks freeze excluded time, reset safely and share manual/auto submission gate', {
	skip: process.platform !== 'win32'
}, () => {
	const dir = mkdtempSync(join(tmpdir(), 'readable-timing-'));
	try {
		const exe = join(dir, 'test.exe');
		execFileSync(join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), ['/nologo', '/out:' + exe, resolve('Assets/Scripts/ReadableTiming.cs'), resolve('Assets/Scripts/CombatClickGate.cs'), resolve('tests/readable-timing-vectors.cs')]);
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
import { createAuthority } from '../server/server.mjs';
test('authority rejects automatic acknowledgments racing a teacher pause while retaining explicit manual review', () => {
	const a = createAuthority({
		classCode: 'READ', teacherKey: 'teacher', timedSetup: false
	});
	const p = [a.call('join', {
		classCode: 'READ'
	}), a.call('join', {
		classCode: 'READ'
	})];
	a.call('teacher/start', {}, 'teacher');
	const m = [...a.matches.values()][0];
	const e = {
		kind: 'combat', seq: 1, side: 0, attacker: '3', defender: 'B', outcome: 1, ack: [false, false], released: [false, false]
	};
	m.events = [e];
	m.reveal = e;
	m.phase = 'play';
	a.call('teacher/pause', {}, 'teacher');
	assert.throws(() => a.call('ack', {
		matchId: m.id, seq: 1, automatic: true
	}, p[0].token), /active session/);
	assert.deepEqual(e.ack, [false, false]);
	a.call('ack', {
		matchId: m.id, seq: 1
	}, p[0].token);
	assert.deepEqual(e.ack, [true, false]);
	a.call('teacher/resume', {}, 'teacher');
	a.call('ack', {
		matchId: m.id, seq: 1, automatic: true
	}, p[1].token);
	assert.equal(m.reveal, null);
});
