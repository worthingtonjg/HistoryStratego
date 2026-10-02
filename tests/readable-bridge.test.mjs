import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function clock() {
	let now = 0, focused = true;
	const events = {};
	const document = {
		hidden: false, hasFocus: () => focused, addEventListener: (n, f) => events[n] = f
	};
	const library = {};
	vm.runInNewContext(readFileSync('Assets/Plugins/WebGL/HistoryBridge.jslib', 'utf8'), {
		LibraryManager: {
			library
		}, mergeInto: Object.assign, Module: {}, performance: {
			now: () => now
		}, document, window: {
			addEventListener: (n, f) => events[n] = f
		}
	});
	return {
		read: () => library.HS_ReadableSeconds(), step: ms => now += ms, blur() {
			focused = false;
			events.blur();
		}, focus() {
			focused = true;
			events.focus();
		}, hidden(v) {
			document.hidden = v;
			events.visibilitychange();
		}
	};
}
test('foreground one-second-plus frames still accumulate five readable seconds', () => {
	const c = clock();
	c.read();
	let elapsed = 0;
	for (let i = 0; i < 4; i++) {
		c.step(1250);
		elapsed += c.read();
	}
	assert.equal(elapsed, 5);
});
test('blur, hidden tab and focus restoration never count excluded time', () => {
	const c = clock();
	c.read();
	c.step(500);
	assert.equal(c.read(), .5);
	c.blur();
	c.step(10000);
	assert.equal(c.read(), 0);
	c.focus();
	c.step(10000);
	assert.equal(c.read(), 0);
	c.step(1250);
	assert.equal(c.read(), 1.25);
	c.hidden(true);
	c.step(10000);
	assert.equal(c.read(), 0);
	c.hidden(false);
	assert.equal(c.read(), 0);
	c.step(500);
	assert.equal(c.read(), .5);
});
