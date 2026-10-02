import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
test('browser remembers only verifier grant across reload; clearing storage requires entry again', () => {
	const values = new Map(), localStorage = {
		getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v)
	};
	function bridge() {
		const context = {
			LibraryManager: {
				library: {}
			}, mergeInto: (a, b) => Object.assign(a, b), localStorage, stringToNewUTF8: v => v, UTF8ToString: v => v
		};
		vm.runInNewContext(readFileSync('Assets/Plugins/WebGL/HistoryBridge.jslib', 'utf8'), context);
		return context.LibraryManager.library;
	}
	let b = bridge();
	assert.equal(b.HS_LoadTeacherGrant(), '');
	b.HS_SaveTeacherGrant('fixture-verifier-id');
	b = bridge();
	assert.equal(b.HS_LoadTeacherGrant(), 'fixture-verifier-id');
	assert.deepEqual([...values.keys()], ['history.teacher.unlocked']);
	values.clear();
	assert.equal(b.HS_LoadTeacherGrant(), '');
});
test('startup respects remembered Unity validation and does not reset it from HTML', () => {
	const csharp = readFileSync('Assets/Scripts/HistoryGame.cs', 'utf8');
	assert(csharp.includes('entryRole == 1 && TeacherGateVerifier.AcceptsRemembered(HS_LoadTeacherGrant())'));
	assert(csharp.includes('HS_SaveTeacherGrant(TeacherGateVerifier.RememberedId())'));
	const bootstrap = readFileSync('browser/bootstrap.mjs', 'utf8');
	assert(!bootstrap.includes("SendMessage('HistoryGame', 'OpenTeacherGate'"));
});
