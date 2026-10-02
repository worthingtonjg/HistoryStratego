import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { COMMANDERS } from '../server/commanders.mjs';
import { createAuthority, serve } from '../server/server.mjs';
import { generateFormation } from '../web/formation.mjs';
import { launchBrowser } from './browser-helper.mjs';
const a = createAuthority({
	timedSetup: false,
	classCode: 'ALIAS', teacherKey: 'fixture',
	commanderPool: process.env.ALIAS_QA_PORTRAITS === '1' ? COMMANDERS.filter(c => ['jubal-anderson-early', 'edward-otho-cresap-ord'].includes(c.id)) : process.env.ALIAS_QA_LONG === '1' ? [0, 1].map(side => COMMANDERS.filter(c => c.side === side).sort((a, b) => b.fullName.length - a.fullName.length)[0]) : COMMANDERS
});
const server = serve(a, 0, process.env.ALIAS_QA_BUILD || 'Builds/JoinAliasesStage');
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
const evidence = 'docs/evidence/join-aliases-run-' + Date.now();
const sleep = ms => new Promise(r => setTimeout(r, ms));
let browser, page;
async function click(x, y) {
	const scale = 1280 / 1200;
	for (const type of ['mousePressed', 'mouseReleased']) {
		await page.call('Input.dispatchMouseEvent', {
			type, x: x * scale, y: y * scale + 20, button: 'left', clickCount: 1
		});
		await sleep(120);
	}
}
try {
	await mkdir(evidence, {
		recursive: true
	});
	browser = await launchBrowser();
	page = await browser.page(base + '/unity/index.html?qa=1', {
		blockSdk: true, initScript: `window.calls=[];window.opened=[];window.open=(url)=>window.opened.push(url);const originalFetch=window.fetch;window.fetch=async(...args)=>{let body;try{body=await new Request(args[0],args[1]).text();}catch{}window.calls.push({url:String(args[0]),body});const r=await originalFetch(...args);try{const d=await r.clone().json();if(d.player)window.snap=d;if(d.roster)window.teacher=d;if(d.match&&!d.player)window.spectator=d;}catch{}return r;};`
	});
	await page.wait('!!window.unityInstance', 120000);
	await sleep(1500);
	await page.screenshot(evidence + '/anonymous-login.png');
	await click(320, 120);
	for (const key of 'ALIAS') {
		await page.call('Input.dispatchKeyEvent', {
			type: 'keyDown', key, text: key
		});
		await page.call('Input.dispatchKeyEvent', {
			type: 'keyUp', key
		});
	}
	await click(350, 204);
	await page.wait('!!window.snap?.player', 30000);
	const joined = await page.evaluate('window.snap');
	await page.wait('!!sessionStorage.getItem("studentToken")', 15000);
	joined.token = await page.evaluate('sessionStorage.getItem("studentToken")');
	assert.ok(joined.commander?.id, "commander assigned immediately on join");
	assert.equal(joined.nickname, joined.commander.name);
	assert.equal(joined.paired, false, "join does not start or pair a match");
	const assigned = joined.commander;
	const joinBody = await page.evaluate('window.calls.find(c=>c.url.endsWith("/api/join")).body');
	assert.ok(!JSON.parse(joinBody).name, 'join collects no human name');
	await sleep(1200);
	await page.screenshot(evidence + '/immediate-profile.png');
	await page.call('Emulation.setDeviceMetricsOverride', {
		width: 900, height: 850, deviceScaleFactor: 1, mobile: false
	});
	await sleep(500);
	await page.screenshot(evidence + '/waiting-narrow.png');
	for (let scroll = 0; scroll < 12; scroll++) {
		await page.call('Input.dispatchMouseEvent', {
			type: 'mouseWheel', x: 500, y: 580, deltaX: 0, deltaY: 350
		});
		await sleep(40);
	}
	await sleep(500);
	await page.screenshot(evidence + '/waiting-instructions-scrolled.png');
	await page.call('Emulation.setDeviceMetricsOverride', {
		width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false
	});
	await sleep(500);
	const second = a.call('join', {
		classCode: 'ALIAS'
	});
	let portraitSecond;
	if (process.env.ALIAS_QA_PORTRAITS === '1') {
		portraitSecond = await browser.page(base + '/unity/index.html?qa=1', {
			blockSdk: true, initScript: `sessionStorage.setItem('studentToken',${JSON.stringify(second.token)});`
		});
		await portraitSecond.wait('!!window.unityInstance', 120000);
		await sleep(3000);
		await portraitSecond.screenshot(evidence + '/ord-waiting.png');
	}
	a.call('teacher/randomize', {}, 'fixture');
	await page.wait('window.snap?.paired===true', 15000);
	assert.equal((await page.evaluate('window.snap.commander')).id, assigned.id, 'pairing preserves commander');
	await sleep(1200);
	await page.screenshot(evidence + '/assigned-waiting.png');
	const studentPage = page;
	const beforeSwap = a.call('teacher/state', {}, 'fixture').roster.map(p => [p.id, p.name, p.side]);
	page = await browser.page(base + '/unity/index.html?qa=1', {
		blockSdk: true,
		initScript: `const originalFetch=window.fetch;window.fetch=async(...args)=>{const r=await originalFetch(...args);try{const d=await r.clone().json();if(d.roster)window.teacher=d;if(d.error)window.lastError=d.error;}catch{}return r;};`
	});
	await page.wait('!!window.unityInstance', 120000);
	await sleep(1500);
	await click(380, 270);
	for (const key of 'fixture') {
		await page.call('Input.dispatchKeyEvent', {
			type: 'keyDown', key, text: key
		});
		await page.call('Input.dispatchKeyEvent', {
			type: 'keyUp', key
		});
	}
	await click(350, 315);
	await page.wait('window.teacher?.roster?.length===2', 15000);
	await sleep(1200);
	await click(250, 210);
	await click(250, 250);
	await page.wait('!!window.lastError', 15000);
	assert.match(await page.evaluate('window.lastError'), /faction|side/i);
	assert.deepEqual(a.call('teacher/state', {}, 'fixture').roster.map(p => [p.id, p.name, p.side]), beforeSwap, 'rejected cross-faction swap preserves assignments');
	await sleep(1200);
	await page.screenshot(evidence + '/teacher-rejected-cross-faction-swap.png');
	page = studentPage;
	a.call('teacher/start', {}, 'fixture');
	await page.wait('window.snap?.match?.phase==="setup"', 15000);
	const current = await page.evaluate('window.snap.match');
	assert.equal(current.commanders[current.side].id, assigned.id);
	a.call('setup', {
		ranks: generateFormation(81)
	}, joined.token);
	a.call('setup', {
		ranks: generateFormation(82)
	}, second.token);
	await page.wait('window.snap?.match?.phase==="play"', 15000);
	await sleep(2500);
	const before = await page.evaluate('window.snap.match');
	await click(1060, 162);
	await sleep(400);
	await page.screenshot(evidence + '/commander-profile.png');
	const selects = await page.evaluate('window.calls.filter(c=>c.url.endsWith("/api/select")).length');
	await click(100, 450);
	assert.equal(await page.evaluate('window.calls.filter(c=>c.url.endsWith("/api/select")).length'), selects, 'modal blocks board input');
	for (let y = 275; y <= 635 && await page.evaluate('window.opened.length') === 0; y += 15)
		await click(existsSync('Assets/Resources/CommanderPortraits/' + assigned.id + '.png') ? 420 : 250, y);
	assert.deepEqual(await page.evaluate('window.opened'), [assigned.sourceUrl], 'profile source opens exact verified URL');
	await click(600, 700);
	await sleep(800);
	const after = await page.evaluate('window.snap.match');
	assert.equal(after.seq, before.seq, 'profile close never moves');
	assert.deepEqual(after.selection, before.selection, 'profile interaction preserves selection');
	await click(1060, 162);
	for (const [width, height] of [[1920, 900], [900, 850]]) {
		await page.call('Emulation.setDeviceMetricsOverride', {
			width, height, deviceScaleFactor: 1, mobile: false
		});
		await sleep(400);
		await page.screenshot(evidence + '/profile-' + width + 'x' + height + '.png');
	}
	if (portraitSecond) {
		const firstPage = page;
		page = portraitSecond;
		await click(1060, 162);
		await sleep(600);
		await page.screenshot(evidence + '/ord-game-profile.png');
		await page.call('Emulation.setDeviceMetricsOverride', {
			width: 900, height: 850, deviceScaleFactor: 1, mobile: false
		});
		await sleep(600);
		await page.screenshot(evidence + '/ord-profile-narrow.png');
		page = firstPage;
	}
	await page.call('Page.reload');
	await page.wait('!!window.unityInstance', 120000);
	await page.wait('!!window.snap?.match?.commanders', 15000);
	assert.equal(await page.evaluate('window.snap.match.commanders[window.snap.match.side].id'), assigned.id);
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', checks: ['anonymous UI join', 'immediate assigned profile', 'pairing preserves commander', 'teacher UI rejects cross-faction swap without mutation', 'frozen match profile', 'modal blocks board selection during play', 'exact source URL', 'close preserves selection and move sequence', 'responsive profiles', 'reconnect stable assignment', 'no live mutation']
	}, null, 2));
	console.log('PASS ' + evidence);
}
catch (e) {
	if (page) {
		await page.screenshot(evidence + '/failure.png');
		await writeFile(evidence + '/diagnostic.json', JSON.stringify({
			logs: page.logs, calls: await page.evaluate('window.calls')
		}, null, 2));
	}
	throw e;
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
