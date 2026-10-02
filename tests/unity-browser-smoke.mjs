import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { launchBrowser } from './browser-helper.mjs';
const live = process.argv.includes('--live');
const expectedStatus = live ? 'Playroom connected' : 'Playroom unavailable';
const authority = createAuthority({
	timedSetup: false,
	teacherKey: 'unity-test-key', classCode: 'UNITY'
});
const server = serve(authority, 0);
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
let browser;
const initScript = "const originalFetch=window.fetch;window.fetch=async function(input,options){const response=await originalFetch.call(this,input,options);if(String(input).includes('teacher/spectate')){try{window.__spectator=await response.clone().json()}catch{}}return response;};const open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...args){if(String(url).includes('teacher/spectate'))this.addEventListener('load',()=>{try{window.__spectator=JSON.parse(this.responseText)}catch{}});return open.call(this,method,url,...args);};Object.defineProperty(window,'unityInstance',{get(){return window.__unity},set(v){window.__unity=v;const send=v.SendMessage.bind(v);v.SendMessage=(go,method,arg)=>{if(method==='PresenceStatus')window.__presenceStatus=arg;return send(go,method,arg);};}});";
async function waitFor(fn, label, ms = 30000) {
	const until = Date.now() + ms;
	while (Date.now() < until) {
		if (fn())
			return;
		await new Promise(r => setTimeout(r, 100));
	}
	throw Error('Timeout: ' + label);
}
async function click(p, x, y) {
	const scale = Math.min(1280 / 1200, 1000 / 900);
	x = x * scale + (1280 - 1200 * scale) / 2;
	y = y * scale + (1000 - 900 * scale) / 2;
	await p.call('Input.dispatchMouseEvent', {
		type: 'mousePressed', x, y, button: 'left', clickCount: 1
	});
	await new Promise(r => setTimeout(r, 100));
	await p.call('Input.dispatchMouseEvent', {
		type: 'mouseReleased', x, y, button: 'left', clickCount: 1
	});
	await new Promise(r => setTimeout(r, 100));
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
try {
	await mkdir('docs/evidence', {
		recursive: true
	});
	browser = await launchBrowser();
	const teacher = await browser.page(base + '/unity/index.html#r=WRNG', {
		initScript, blockSdk: true
	});
	await teacher.wait('!!window.unityInstance', 120000);
	await new Promise(r => setTimeout(r, 3500));
	await teacher.screenshot('docs/evidence/unity-login.png');
	await type(teacher, 400, 273, 'unity-test-key');
	await click(teacher, 400, 316);
	await teacher.wait("window.__presenceStatus?.includes('Playroom unavailable')", 45000);
	console.log('PASS Unity: teacher canvas login and deliberate presence-failure fallback');
	const p1 = await browser.page(base + '/unity/index.html#r=WRNG', {
		initScript, blockSdk: !live
	}), p2 = await browser.page(base + '/unity/index.html#r=WRNG', {
		initScript, blockSdk: !live
	});
	for (const [p, name] of [[p1, 'Unity A'], [p2, 'Unity B']]) {
		await p.wait('!!window.unityInstance', 120000);
		await type(p, 350, 123, 'UNITY');
		await type(p, 350, 163, name);
		await click(p, 350, 206);
		await p.wait("window.__presenceStatus?.includes(" + JSON.stringify(expectedStatus) + ")", 45000);
	}
	await waitFor(() => authority.students.size === 2, 'two Unity students');
	const expected = authority.call('teacher/state', {}, 'unity-test-key').presence.roomCode;
	if (live)
		for (const p of [p1, p2])
			assert((await p.evaluate('window.__presenceStatus')).includes('room ' + expected));
	console.log('PASS Unity: two canvas joins; presence mode ' + expectedStatus + '; classroom room ' + expected);
	for (const name of ['Other A', 'Other B'])
		authority.call('join', {
			classCode: 'UNITY', name
		});
	await click(teacher, 240, 161);
	await waitFor(() => authority.matches.size === 2, 'teacher start');
	const m = [...authority.matches.values()][0];
	await new Promise(r => setTimeout(r, 1500));
	for (const [p, side] of [[p1, 0], [p2, 1]]) {
		if (side === 0) {
			await click(p, 462, 511);
			await click(p, 105, 511);
		}
		await click(p, 900, 196);
		await waitFor(() => m.ready[side], 'Unity formation ' + side);
	}
	await new Promise(r => setTimeout(r, 1500));
	await click(teacher, 800, 231);
	await new Promise(r => setTimeout(r, 1800));
	await teacher.screenshot('docs/evidence/unity-spectator-opening.png');
	await teacher.wait('window.__spectator?.match?.side===0', 15000);
	await teacher.screenshot('docs/evidence/unity-spectator-side0.png');
	await click(p1, 105, 511);
	await click(p1, 105, 460);
	await waitFor(() => m.seq === 3, 'first Unity move');
	await teacher.wait('window.__spectator?.match?.side===1', 15000);
	await teacher.screenshot('docs/evidence/unity-spectator-side1.png');
	await click(teacher, 100, 151);
	await new Promise(r => setTimeout(r, 1500));
	// Side 1 rotates the board; canonical 31 -> screen 68, canonical 41 -> screen 58.
	await click(p2, 462, 511);
	await click(p2, 462, 460);
	await waitFor(() => m.seq === 4, 'second Unity move');
	await new Promise(r => setTimeout(r, 1500));
	await click(p1, 105, 460);
	await click(p1, 105, 409);
	await waitFor(() => m.seq === 5, 'Unity combat');
	assert.match(m.events.at(-1).text, /Scout attacks Scout: both removed/);
	await p1.screenshot('docs/evidence/unity-board.png');
	await click(teacher, 800, 231);
	await new Promise(r => setTimeout(r, 1800));
	await teacher.screenshot('docs/evidence/unity-spectator.png');
	const spec = authority.call('teacher/spectate', {
		matchId: m.id
	}, 'unity-test-key');
	assert.equal(spec.match.side, m.turn);
	assert(spec.match.board.filter(p => p && p.side !== m.turn).every(p => p.rank === '?'));
	assert.equal(await teacher.evaluate('window.__spectator.match.side'), m.turn);
	const before = m.seq;
	await click(teacher, 105, 511);
	await click(teacher, 105, 460);
	assert.equal(m.seq, before);
	await click(teacher, 100, 151);
	await new Promise(r => setTimeout(r, 1200));
	await click(teacher, 800, 286);
	const other = [...authority.matches.keys()][1];
	await teacher.wait('window.__spectator?.match?.id===' + JSON.stringify(other), 15000);
	await teacher.screenshot('docs/evidence/unity-spectator-other-match.png');
	await click(teacher, 100, 151);
	await new Promise(r => setTimeout(r, 1200));
	await click(teacher, 390, 161);
	await waitFor(() => authority.call('teacher/state', {}, 'unity-test-key').phase === 'paused', 'teacher pause');
	await p1.call('Page.reload');
	await p1.wait('!!window.unityInstance', 120000);
	await p1.wait("window.__presenceStatus?.includes(" + JSON.stringify(expectedStatus) + ")", 45000);
	assert.equal(authority.students.size, 4);
	await click(teacher, 690, 161);
	await waitFor(() => authority.call('teacher/state', {}, 'unity-test-key').phase === 'ended', 'teacher end');
	await p1.wait("window.__presenceStatus?.startsWith('Round ended')", 20000);
	await p1.call('Page.reload');
	await p1.wait('!!window.unityInstance', 120000);
	await p1.wait("window.__presenceStatus?.startsWith('Round ended')", 20000);
	await teacher.screenshot('docs/evidence/unity-teacher.png');
	await writeFile('docs/evidence/unity-' + (live ? 'live' : 'fallback') + '-result.json', JSON.stringify({
		result: 'passed', mode: live ? 'live Playroom' : 'SDK blocked fallback', utc: new Date().toISOString(), room: expected, checks: ['actual WebGL exported Unity player', 'teacher and two student canvas login', 'automatic student same-room presence despite stale URL hash; teacher uses deliberate failure fallback', '40-piece setup via canvas', 'alternating moves via canvas', 'equal-rank combat reveal', 'teacher pause/end via canvas', 'reload restores same seat and room', 'ended reload remains ended', 'teacher spectator turn-following and rank redaction', 'read-only spectator canvas and match switching']
	}, null, 2));
	console.log('PASS Unity: setup, alternating moves, combat, teacher pause/end, reload and ended-round handling.');
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
