import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
test('header names use measured ellipsis and preserve Unicode boundaries', () => {
	const dir = mkdtempSync(join(tmpdir(), 'history-header-name-')), exe = join(dir, 'names.exe');
	try {
		execFileSync(join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), ['/nologo', '/codepage:65001', '/out:' + exe, resolve('Assets/Scripts/HeaderName.cs'), resolve('tests/header-name-vectors.cs')]);
		assert(execFileSync(exe, {
			encoding: 'utf8'
		}).includes('PASS'));
	}
	finally {
		rmSync(dir, {
			recursive: true, force: true
		});
	}
});
test('header text and underline share measured width while profile links retain their slots', () => {
	const source = readFileSync('Assets/Scripts/HistoryGame.cs', 'utf8');
	assert(source.includes('HeaderName.Fit(fullName, nameRect.width'));
	assert(source.includes('nameRect.center.x - visibleWidth / 2'));
	assert(source.includes('matchHeaderY + 37, visibleWidth, 1'));
	assert(source.includes('GUI.Button(linkRect, GUIContent.none, GUIStyle.none)'));
	assert(source.includes('new GUIContent(visibleName, fullName)'));
});
