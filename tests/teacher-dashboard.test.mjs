import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { installJoinPanel, STUDENT_PORTAL } from '../browser/join-panel.mjs';
test('compiled dashboard policy follows phase, connected opposing factions and existing matches', () => {
	const dir = mkdtempSync(join(tmpdir(), 'history-actions-')), exe = join(dir, 'actions.exe');
	try {
		execFileSync(join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), ['/nologo', '/out:' + exe, resolve('Assets/Scripts/TeacherActionPolicy.cs'), resolve('tests/teacher-actions-vectors.cs')]);
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
function element() {
	return {
		events: {}, open: false, textContent: '', addEventListener(n, f) {
			this.events[n] = f;
		}, showModal() {
			this.open = true;
		}, close() {
			this.open = false;
			this.events.close?.();
		}, focus() {
			this.focused = true;
		}
	};
}
test('projector panel reads current code, shows only student address and closes without game commands', () => {
	const button = element(), dialog = element(), codeElement = element(), urlElement = element(), closeButton = element();
	let code = 'ABCD';
	installJoinPanel({
		button, dialog, codeElement, urlElement, closeButton, getCode: () => code
	});
	button.events.click();
	assert(dialog.open);
	assert.equal(codeElement.textContent, 'ABCD');
	assert.equal(urlElement.href, STUDENT_PORTAL);
	assert(!urlElement.href.includes('teacher'));
	closeButton.events.click();
	assert(!dialog.open);
	assert(button.focused);
	code = 'NEXT';
	button.events.click();
	assert.equal(codeElement.textContent, 'NEXT');
	const panel = readFileSync('tools/package-browser.mjs', 'utf8').match(/const joinPanel = `([\s\S]*?)`;/)[1];
	assert(!/recovery|teacher-key|private-code|teacher\.html/.test(panel));
});
test('compiled pair layout groups both seats, separates waiting and matches games by player identity', () => {
	const dir = mkdtempSync(join(tmpdir(), 'history-pairs-')), exe = join(dir, 'pairs.exe');
	try {
		execFileSync(join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), ['/nologo', '/out:' + exe, resolve('Assets/Scripts/TeacherPairLayout.cs'), resolve('tests/teacher-pairs-vectors.cs')]);
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
