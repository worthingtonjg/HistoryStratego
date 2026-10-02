import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { COMMANDERS } from '../server/commanders.mjs';
import { launchBrowser } from './browser-helper.mjs';
let offset = 0;
const a = createAuthority({
	classCode: 'INTRO', teacherKey: 'fixture', now: () => Date.now() + offset, commanderPool: [0, 1].map(side => COMMANDERS.filter(c => c.side === side).sort((x, y) => y.fullName.length - x.fullName.length)[0])
});
const seats = [a.call('join', {
	classCode: 'INTRO'
}), a.call('join', {
	classCode: 'INTRO'
})];
a.call('teacher/start', {}, 'fixture');
const m = [...a.matches.values()][0];
const server = serve(a, 0, 'Builds/IntroductionStage');
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port, evidence = 'docs/evidence/intro-run-' + Date.now(), sleep = ms => new Promise(r => setTimeout(r, ms));
let browser;
const pages = [];
async function click(p, x, y) {
	for (const type of ['mousePressed', 'mouseReleased']) {
		await p.call('Input.dispatchMouseEvent', {
			type, x: x * 1280 / 1200, y: y * 1280 / 1200 + 20, button: 'left', clickCount: 1
		});
		await sleep(100);
	}
}
async function hover(p, x, y) {
	await p.call('Input.dispatchMouseEvent', {
		type: 'mouseMoved', x: x * 1280 / 1200, y: y * 1280 / 1200 + 20
	});
	await sleep(600);
}
async function until(fn, label, timeout = 25000) {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await fn())
			return;
		await sleep(100);
	}
	throw Error('Timeout ' + label);
}
function point(k, side) {
	const i = side === 0 ? 60 + k : 39 - k, n = side === 0 ? i : 99 - i, x = n % 10 - 4.5, z = 4.5 - Math.floor(n / 10) - .11, y = .645, l = Math.hypot(13.85, 13), u = .5 + x / (8 * (1100 / 706)), v = .5 + ((y - 14) * 13 / l + (z + 13) * 13.85 / l) / 8;
	return [25 + u * 865, 178 + (1 - v) * 555];
}
const snapshot = p => p.evaluate('window.snap');
async function loadSeat(i) {
	const p = await browser.page(base + '/unity/index.html?qa=1', {
		blockSdk: true, initScript: `sessionStorage.setItem('studentToken',${JSON.stringify(seats[i].token)});window.calls=[];window.opened=[];window.open=url=>window.opened.push(url);const fetchOriginal=window.fetch;window.fetch=async(...args)=>{window.calls.push(String(args[0]));const r=await fetchOriginal(...args);try{const s=await r.clone().json();if(s.player)window.snap=s;if(s.match&&!s.player)window.spectator=s;}catch{}return r;};`
	});
	pages.push(p);
	await p.wait('!!window.unityInstance', 120000);
	await p.wait('!!window.snap?.match?.setup?.enabled', 20000);
	await sleep(1300);
	return p;
}
try {
	await mkdir(evidence, {
		recursive: true
	});
	browser = await launchBrowser();
	const red = await loadSeat(0);
	await red.call('Page.bringToFront');
	assert.equal((await snapshot(red)).match.setup.started, false);
	await red.screenshot(evidence + '/versus.png');
	await hover(red, 465, 90);
	assert.equal(await red.evaluate('getComputedStyle(document.querySelector("canvas")).cursor'), 'pointer');
	await click(red, 465, 90);
	await sleep(500);
	await red.screenshot(evidence + '/header-profile.png');
	await hover(red, 465, 90);
	assert.equal(await red.evaluate('getComputedStyle(document.querySelector("canvas")).cursor'), 'default', 'modal suppresses underlying header cursor');
	const ownSource = (await snapshot(red)).match.commanders[0].sourceUrl;
	for (let y = 290; y < 630 && await red.evaluate('window.opened.length') === 0; y += 15) {
		await hover(red, 420, y);
		if (await red.evaluate('getComputedStyle(document.querySelector("canvas")).cursor') === 'pointer')
			await click(red, 420, y);
	}
	assert.deepEqual(await red.evaluate('window.opened'), [ownSource]);
	const beforeCalls = await red.evaluate('window.calls.filter(x=>/setup\\/(begin|swap)/.test(x)).length');
	await click(red, 100, 470);
	assert.equal(await red.evaluate('window.calls.filter(x=>/setup\\/(begin|swap)/.test(x)).length'), beforeCalls);
	await click(red, 600, 700);
	await sleep(800);
	await click(red, 600, 794);
	await red.wait('window.snap?.match?.setup?.started===true');
	const first = await snapshot(red), deadline = first.match.setup.deadline;
	assert(deadline - Date.now() - offset > 56000);
	assert.equal(a.call('state', {}, seats[1].token).match.setup.started, false);
	const draft = first.match.setup.draft, flag = draft.indexOf('F'), scout = draft.indexOf('2');
	await click(red, ...point(flag, 0));
	await click(red, ...point(scout, 0));
	await red.wait('window.snap?.match?.setup?.revision===1');
	const expected = [...draft];
	[expected[flag], expected[scout]] = [expected[scout], expected[flag]];
	assert.deepEqual((await snapshot(red)).match.setup.draft, expected);
	await red.screenshot(evidence + '/setup-bottom-panel.png');
	a.call('teacher/pause', {}, 'fixture');
	await red.wait('window.snap?.phase==="paused"');
	const frozen = (await snapshot(red)).match.setup.remainingMs;
	await sleep(1600);
	assert.equal((await snapshot(red)).match.setup.remainingMs, frozen);
	await red.screenshot(evidence + '/setup-paused.png');
	await red.call('Page.reload');
	await red.wait('!!window.unityInstance', 120000);
	await red.wait('window.snap?.phase==="paused"');
	assert.deepEqual((await snapshot(red)).match.setup.draft, expected);
	assert.equal((await snapshot(red)).match.setup.started, true);
	assert.equal((await snapshot(red)).match.setup.remainingMs, frozen);
	const blue = await loadSeat(1);
	await blue.call('Page.bringToFront');
	await blue.call('Emulation.setDeviceMetricsOverride', {
		width: 900, height: 850, deviceScaleFactor: 1, mobile: false
	});
	await sleep(700);
	await blue.screenshot(evidence + '/versus-narrow-paused.png');
	await blue.call('Emulation.setDeviceMetricsOverride', {
		width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false
	});
	a.call('teacher/resume', {}, 'fixture');
	await red.wait('window.snap?.phase==="active"');
	offset += Math.max(0, frozen - 5000);
	await red.call('Page.bringToFront');
	await red.wait('window.snap?.match?.setup?.remainingMs<5500');
	await sleep(900);
	await red.screenshot(evidence + '/setup-near-zero.png');
	await until(() => m.ready[0], 'server automatic setup lock', 8000);
	assert.deepEqual(m.board.slice(60).map(p => p.rank), expected);
	assert.equal(m.ready[1], false);
	await blue.call('Page.bringToFront');
	await blue.wait('window.snap?.phase==="active"');
	await click(blue, 600, 794);
	await blue.wait('window.snap?.match?.setup?.started===true');
	const b = (await snapshot(blue)).match.setup.draft, bf = b.indexOf('F'), bs = b.indexOf('2');
	await click(blue, ...point(bf, 1));
	await click(blue, ...point(bs, 1));
	await blue.wait('window.snap?.match?.setup?.revision===1');
	await click(blue, 1040, 812);
	await until(() => m.phase === 'play', 'early manual Start Game locks own formation');
	assert.equal(m.seq, 2);
	await blue.wait('window.snap?.match?.phase==="play"');
	await sleep(1200);
	await blue.screenshot(evidence + '/game-log-and-dark-board.png');
	await hover(blue, 730, 90);
	assert.equal(await blue.evaluate('getComputedStyle(document.querySelector("canvas")).cursor'), 'pointer');
	await click(blue, 730, 90);
	await sleep(500);
	await blue.screenshot(evidence + '/blue-profile.png');
	await click(blue, 600, 700);
	await sleep(800);
	await red.call('Page.bringToFront');
	await red.wait('window.snap?.match?.phase==="play"');
	await sleep(17500);
	await red.screenshot(evidence + '/turn-reminder.png');
	assert.equal(m.seq, 2, 'reminder never moves');
	// Each isolated Chrome context has its own window. Freeze the inactive page
	// explicitly so headless window focus cannot silently foreground both players.
	await blue.call('Page.setWebLifecycleState', {
		state: 'frozen'
	});
	await red.call('Page.bringToFront');
	assert.equal(await red.evaluate('document.hasFocus() && !document.hidden'), true);
	// Isolated deterministic combat fixture; no live game is inspected or modified.
	m.board.fill(null);
	for (const [i, side, rank] of [[60, 0, '3'], [50, 1, 'B'], [99, 0, 'F'], [0, 1, 'F'], [10, 1, '2']])
		m.board[i] = {
			id: 'qa-' + i, side, rank
		};
	m.history = [[], []];
	m.selection = null;
	m.turn = 0;
	m.seq++;
	a.call('move', {
		from: 60, to: 50, seq: m.seq, requestId: 'fixture-combat'
	}, seats[0].token);
	await red.wait('window.snap?.match?.battle?.kind==="combat"');
	await sleep(4500);
	a.call('teacher/pause', {}, 'fixture');
	await red.wait('window.snap?.phase==="paused"');
	await sleep(6000);
	assert.equal(m.reveal.ack[0], false, 'pause holds auto acknowledgment');
	await red.screenshot(evidence + '/battle-border-paused.png');
	a.call('teacher/resume', {}, 'fixture');
	await until(() => m.reveal?.ack[0] === true, 'own automatic continue', 12000);
	assert.equal(m.reveal.ack[1], false, 'frozen background opponent was not acknowledged');
	await blue.call('Page.setWebLifecycleState', {
		state: 'active'
	});
	await red.call('Emulation.setFocusEmulationEnabled', {
		enabled: false
	});
	await blue.call('Emulation.setFocusEmulationEnabled', {
		enabled: true
	});
	await blue.call('Page.bringToFront');
	assert.equal(await blue.evaluate('document.hasFocus() && !document.hidden'), true, 'restored headless player is foreground eligible');
	a.call('teacher/pause', {}, 'fixture');
	await blue.wait('window.snap?.phase==="paused" && window.snap?.match?.battle?.kind==="combat"');
	await sleep(3000);
	await blue.call('Emulation.setDeviceMetricsOverride', {
		width: 900, height: 850, deviceScaleFactor: 1, mobile: false
	});
	await sleep(500);
	await blue.screenshot(evidence + '/battle-border-narrow.png');
	a.call('teacher/resume', {}, 'fixture');
	await until(() => m.reveal === null, 'both independent visible acknowledgments', 12000);
	a.call('teacher/end', {}, 'fixture');
	a.call('state', {}, seats[0].token);
	a.call('state', {}, seats[1].token);
	a.call('teacher/start', {}, 'fixture');
	await blue.wait('window.snap?.match?.phase==="setup" && !window.snap.match.setup.started');
	await blue.screenshot(evidence + '/next-round-intro.png');
	const teacher = await browser.page(base + '/unity/index.html?qa=1', {
		blockSdk: true, initScript: `window.calls=[];const original=window.fetch;window.fetch=async(...args)=>{window.calls.push(String(args[0]));const r=await original(...args);try{const s=await r.clone().json();if(s.roster)window.teacher=s;if(s.match&&!s.player)window.spectator=s;}catch{}return r;};`
	});
	pages.push(teacher);
	await teacher.wait('!!window.unityInstance', 120000);
	await sleep(1200);
	await click(teacher, 400, 273);
	for (const key of 'fixture') {
		await teacher.call('Input.dispatchKeyEvent', {
			type: 'keyDown', key, text: key
		});
		await teacher.call('Input.dispatchKeyEvent', {
			type: 'keyUp', key
		});
	}
	await click(teacher, 400, 316);
	await teacher.wait('!!window.teacher?.matches?.length');
	await sleep(700);
	await click(teacher, 800, 231);
	await teacher.wait('!!window.spectator?.match');
	await sleep(700);
	await teacher.screenshot(evidence + '/teacher-empty-setup.png');
	await hover(teacher, 465, 90);
	assert.equal(await teacher.evaluate('getComputedStyle(document.querySelector("canvas")).cursor'), 'pointer');
	await click(teacher, 465, 90);
	await sleep(700);
	await teacher.screenshot(evidence + '/teacher-readonly-profile.png');
	await click(teacher, 600, 700);
	await sleep(800);
	await click(teacher, 730, 90);
	await sleep(700);
	await teacher.screenshot(evidence + '/teacher-other-profile.png');
	assert.equal(await teacher.evaluate('window.calls.filter(x=>x.includes("/setup")||x.includes("/ack")).length'), 0);
	assert([...a.matches.values()][0].setupClocks.every(c => !c.started), 'spectator profile actions never start timers');
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', checks: ['two-profile intro normal/narrow', 'real browser pointer and modal reset', 'exact source URL', 'modal blocks setup input', 'independent 60-second starts', 'saved Red and Blue swaps', 'pause/reload retains draft and remaining time', 'server timeout locks current draft', 'manual early Start Game', 'Game Log and dark board', '15-second reminder never moves', 'five visible seconds auto-continue with pause/background guard', 'both-player barrier', 'quote border and centered footer', 'new-round intro']
	}, null, 2));
	console.log('PASS ' + evidence);
}
catch (e) {
	for (let i = 0; i < pages.length; i++) {
		try {
			await pages[i].screenshot(evidence + '/failure-' + i + '.png');
		}
		catch {
		}
	}
	console.error(evidence);
	throw e;
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
