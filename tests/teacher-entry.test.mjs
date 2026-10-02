import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { currentClassroom, rememberClassroom, retireClassroom } from '../browser/classroom-memory.mjs';
test('retirement retains checkpoints and cannot resurrect a previous current pointer', () => {
	const data = new Map();
	globalThis.localStorage = {
		getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k)
	};
	data.set('history.teacher.OLD', 'retained ciphertext');
	rememberClassroom('OLD', 'private-local');
	retireClassroom('OLD');
	assert.equal(currentClassroom(), null);
	assert(data.has('history.teacher.OLD'));
	assert.throws(() => rememberClassroom('OLD', 'private-local'), /Class ended/);
	rememberClassroom('NEW', 'private-new');
	retireClassroom('OLD');
	assert.equal(currentClassroom().code, 'NEW');
});
test('student entry template exposes only student join controls', () => {
	const source = readFileSync('tools/package-browser.mjs', 'utf8'), student = source.match(/const studentEntry = `([\s\S]*?)`;/)[1], bar = source.match(/const studentBar = `([\s\S]*?)`;/)[1];
	assert(student.includes('id="join-code"'));
	assert(student.includes('id="join"'));
	assert(!/id="(?:create|recover|private-code|new-class|teacher-tools)"/.test(student + bar));
	const bootstrap = readFileSync('browser/bootstrap.mjs', 'utf8');
	assert(bootstrap.includes("previous?.role === 'student'"));
});
test('compiled Unity verifier fails closed and accepts only matching fixture input', () => {
	const dir = mkdtempSync(join(tmpdir(), 'history-gate-')), exe = join(dir, 'gate.exe');
	try {
		execFileSync(join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), ['/nologo', '/out:' + exe, resolve('Assets/Scripts/TeacherGateVerifier.cs'), resolve('tests/teacher-gate-vectors.cs')]);
		assert(execFileSync(exe, {
			encoding: 'utf8'
		}).includes('PASS compiled'));
	}
	finally {
		rmSync(dir, {
			recursive: true, force: true
		});
	}
});
