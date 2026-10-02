import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClassExit } from '../browser/class-exit.mjs';
function fixture(answer = true) {
	const values = new Map([['history.browserSession', 'old'], ['history.newClass', '1'], ['history.teacher.unlocked', 'remembered']]);
	const calls = [];
	let resolve;
	const runtime = {
		role: 'teacher', retire: async () => {
			calls.push('retire');
			if (resolve)
				await resolve;
		}
	};
	const exit = createClassExit({
		getRuntime: () => runtime, isAllowed: () => true, confirm: m => {
			calls.push(m);
			return answer;
		}, storage: {
			setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k)
		}, navigate: () => calls.push('navigate'), onPending: () => calls.push('pending'), onError: e => calls.push(e.message)
	});
	return {
		values, calls, exit, runtime, hold: p => resolve = p
	};
}
test('cancel End class has no retirement, navigation or storage changes', async () => {
	const f = fixture(false), before = [...f.values];
	assert.equal(await f.exit(false), false);
	assert.deepEqual([...f.values], before);
	assert.equal(f.calls.length, 1);
	assert.match(f.calls[0], /All games will end/);
});
test('End class retires once, clears auto-create and keeps remembered unlock', async () => {
	const f = fixture();
	assert.equal(await f.exit(false), true);
	assert.equal(f.calls.filter(x => x === 'retire').length, 1);
	assert.equal(f.calls.at(-1), 'navigate');
	assert(!f.values.has('history.browserSession'));
	assert(!f.values.has('history.newClass'));
	assert.equal(f.values.get('history.teacher.unlocked'), 'remembered');
	assert.equal(await f.exit(false), false);
});
test('New class still requests fresh creation only after retirement; failure preserves recovery state', async () => {
	const f = fixture();
	await f.exit(true);
	assert.equal(f.values.get('history.newClass'), '1');
	const bad = fixture();
	bad.runtime.retire = async () => {
		throw Error('network');
	};
	assert.equal(await bad.exit(false), false);
	assert.equal(bad.values.get('history.browserSession'), 'old');
	assert(!bad.calls.includes('navigate'));
});
test('duplicate confirmation/click during retirement does not start a second exit', async () => {
	const f = fixture();
	let done;
	f.hold(new Promise(r => done = r));
	const first = f.exit(false);
	assert.equal(await f.exit(true), false);
	done();
	await first;
	assert.equal(f.calls.filter(x => x === 'retire').length, 1);
});
test('End round retains existing action while End class is available in the teacher toolbar', () => {
	const unity = readFileSync('Assets/Scripts/HistoryGame.cs', 'utf8'), page = readFileSync('tools/package-browser.mjs', 'utf8'), boot = readFileSync('browser/bootstrap.mjs', 'utf8');
	assert(unity.includes('action == "end" ? "END ROUND"'));
	assert(page.includes('id="end-class">End class'));
	assert(boot.includes("document.querySelector('#end-class').onclick = () => exitClass(false)"));
	assert(boot.includes("else if (sessionStorage.getItem('history.newClass') === '1')"));
	assert(boot.includes('Teacher unlocked. Create a classroom when ready.'));
});
