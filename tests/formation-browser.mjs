import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { launchBrowser } from './browser-helper.mjs';
const evidence = 'docs/evidence/formation-run-' + Date.now();
const a = createAuthority({
	timedSetup: false,
	teacherKey: 'formation-test', classCode: 'FORM'
}), server = serve(a, 0, process.env.FORMATION_QA_BUILD || 'Builds/PortraitsStage');
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
const initScript = `window.__drafts=[];window.__capture=true;const originalFetch=window.fetch;window.fetch=async function(input,options){if(String(input).endsWith('/api/setup')){const text=typeof options.body==='string'?options.body:await new Response(options.body).text();window.__drafts.push(JSON.parse(text).ranks);if(window.__capture)return new Response(JSON.stringify({error:'QA captured draft; still editable'}),{status:400,headers:{'Content-Type':'application/json'}});}return originalFetch.call(this,input,options);};`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let browser, pages = [];
async function wait(fn, label) {
	for (let i = 0; i < 120; i++) {
		if (fn())
			return;
		await sleep(250);
	}
	throw Error('Timeout ' + label);
}
async function click(p, x, y) {
	const scale = 1280 / 1200;
	x = x * scale;
	y = y * scale + 20;
	await p.call('Input.dispatchMouseEvent', {
		type: 'mousePressed', x, y, button: 'left', clickCount: 1
	});
	await sleep(100);
	await p.call('Input.dispatchMouseEvent', {
		type: 'mouseReleased', x, y, button: 'left', clickCount: 1
	});
	await sleep(200);
}
async function type(p, x, y, text) {
	await click(p, x, y);
	for (const key of text) {
		await p.call('Input.dispatchKeyEvent', {
			type: 'keyDown', key, text: key
		});
		await p.call('Input.dispatchKeyEvent', {
			type: 'keyUp', key
		});
	}
}
function point(i, side = 0) {
	const n = side === 0 ? i : 99 - i, x = n % 10 - 4.5, z = 4.5 - Math.floor(n / 10) - .11, y = .645, len = Math.hypot(13.85, 13), u = .5 + x / (8 * (1100 / 706)), v = .5 + ((y - 14) * 13 / len + (z + 13) * 13.85 / len) / 8;
	return [25 + u * 865, 178 + (1 - v) * 555];
}
function check(r) {
	assert.equal(r.length, 40);
	const counts = {
		F: 1, B: 6, 1: 1, 2: 8, 3: 5, 4: 4, 5: 4, 6: 4, 7: 3, 8: 2, 9: 1, 10: 1
	};
	for (const [k, n] of Object.entries(counts))
		assert.equal(r.filter(x => x === k).length, n);
	const f = r.indexOf('F');
	assert(f >= 30);
	assert.equal(r[f - 10], 'B');
	if (f % 10 > 0)
		assert.equal(r[f - 1], 'B');
	if (f % 10 < 9)
		assert.equal(r[f + 1], 'B');
	assert.equal(r.slice(0, 10).filter(x => x === '2').length, 8);
}
async function capture(p) {
	const n = await p.evaluate('window.__drafts.length');
	await click(p, 1060, 196);
	await p.wait('window.__drafts.length>' + n);
	return p.evaluate('window.__drafts.at(-1)');
}
try {
	await mkdir(evidence, {
		recursive: true
	});
	browser = await launchBrowser();
	for (const name of ['Formation Alex', 'Formation Sam']) {
		const p = await browser.page(base + '/unity/index.html', {
			blockSdk: true, initScript
		});
		pages.push(p);
		await p.wait('!!window.unityInstance', 120000);
		await sleep(1500);
		await type(p, 350, 123, 'FORM');
		await click(p, 350, 206);
	}
	await wait(() => a.students.size === 2, 'two Unity students');
	a.call('teacher/start', {}, 'formation-test');
	await sleep(2200);
	const initial = [], shuffled = [];
	for (let side = 0; side < 2; side++) {
		const p = pages[side];
		initial.push(await capture(p));
		check(initial[side]);
		await sleep(500);
		await click(p, 960, 196);
		shuffled.push(await capture(p));
		check(shuffled[side]);
		await p.screenshot(evidence + '/setup-side' + side + '.png');
		// Swap the actual known draft's flag with a front scout using real board clicks.
		const ranks = shuffled[side], flag = ranks.indexOf('F'), scout = ranks.indexOf('2'), index = k => side === 0 ? 60 + k : 39 - k;
		await sleep(500);
		await click(p, ...point(index(flag), side));
		await click(p, ...point(index(scout), side));
		const swapped = await capture(p), expected = [...ranks];
		[expected[flag], expected[scout]] = [expected[scout], expected[flag]];
		assert.deepEqual(swapped, expected, 'canvas manual swap side ' + side);
		await p.evaluate('window.__capture=false');
		await sleep(500);
		await click(p, 1060, 196);
	}
	const m = [...a.matches.values()][0];
	await wait(() => m.phase === 'play', 'both full formations locked');
	assert.equal(m.board.filter(Boolean).length, 80);
	assert.equal(m.seq, 2);
	console.log('PASS actual Unity: both default setups, both Shuffle buttons, manual swaps and full lock.');
	// Start a separate QA round, verifying the clients generate fresh constrained defaults.
	a.call('teacher/end', {}, 'formation-test');
	a.call('teacher/start', {}, 'formation-test');
	await sleep(2400);
	for (const p of pages) {
		await p.evaluate('window.__capture=true');
		check(await capture(p));
	}
	const second = [...a.matches.values()][0];
	assert.equal(second.seq, 0);
	assert.equal(second.board.filter(Boolean).length, 0);
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', utc: new Date().toISOString(), checks: ['actual staged Unity WebGL', 'two isolated student contexts', 'both oriented initial constrained formations', 'both Shuffle formation buttons constrained', 'canvas manual flag/scout swap accepted for both orientations', '80 pieces locked with correct counts', 'next round independently generates constrained defaults', 'only QA classroom used; live paused match untouched'], independentInitial: JSON.stringify(initial[0]) !== JSON.stringify(initial[1]), independentShuffled: JSON.stringify(shuffled[0]) !== JSON.stringify(shuffled[1])
	}, null, 2));
	console.log('PASS actual Unity: next-round default regenerated; ' + evidence);
}
catch (e) {
	for (let i = 0; i < pages.length; i++)
		await pages[i].screenshot(evidence + '/failure' + i + '.png');
	throw e;
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
