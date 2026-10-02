const halfHeight = Number((await readFile('Assets/Scripts/TabletopBoard.cs', 'utf8')).match(/BoardHalfHeight\s*=\s*([0-9.]+)f/)[1]), layout = await readFile('Assets/Scripts/HistoryGame.cs', 'utf8'), rect = layout.match(/boardRect\s*=\s*new Rect\(([^)]+)\)/)[1].split(',').map(Number), rw = Number(layout.match(/boardRenderWidth\s*=\s*(\d+)/)[1]), rh = Number(layout.match(/boardRenderHeight\s*=\s*(\d+)/)[1]);
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { generateFormation } from '../web/formation.mjs';
import { launchBrowser } from './browser-helper.mjs';
const a = createAuthority({
	timedSetup: false,
	classCode: 'TURN', teacherKey: 'fixture'
}), seats = ['Jon', 'Computer'].map(name => a.call('join', {
	classCode: 'TURN', name
}));
a.call('teacher/start', {}, 'fixture');
const m = [...a.matches.values()][0], server = serve(a, 0, 'Builds/TurnStage');
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port, evidence = 'docs/evidence/turn-run-' + Date.now();
let browser;
const pages = [], sleep = ms => new Promise(r => setTimeout(r, ms));
const count = p => p.logs.filter(e => e.method === 'Runtime.consoleAPICalled' && JSON.stringify(e.params).includes('YOUR_TURN_NOTICE')).length;
async function until(fn, label) {
	const end = Date.now() + 25000;
	while (Date.now() < end) {
		if (fn())
			return;
		await sleep(50);
	}
	throw Error('Timeout ' + label);
}
async function click(p, x, y) {
	const scale = Math.min(1280 / 1200, 1000 / 900);
	x = x * scale + (1280 - 1200 * scale) / 2;
	y = y * scale + (1000 - 900 * scale) / 2;
	for (const type of ['mousePressed', 'mouseReleased']) {
		await p.call('Input.dispatchMouseEvent', {
			type, x, y, button: 'left', clickCount: 1
		});
		await sleep(100);
	}
}
function point(i, side = 0, piece = true) {
	const n = side === 0 ? i : 99 - i, x = n % 10 - 4.5, z = 4.5 - Math.floor(n / 10) - (piece ? .11 : 0), y = piece ? .645 : .055, l = Math.hypot(13.85, 13), u = .5 + x / ((2 * halfHeight) * (rw / rh)), v = .5 + ((y - 14) * 13 / l + (z + 13) * 13.85 / l) / (2 * halfHeight);
	return [rect[0] + u * rect[2], rect[1] + (1 - v) * rect[3]];
}
try {
	await mkdir(evidence, {
		recursive: true
	});
	browser = await launchBrowser();
	for (const s of seats) {
		const p = await browser.page(base + '/unity/index.html?qa=1', {
			blockSdk: true, initScript: 'sessionStorage.setItem("studentToken",' + JSON.stringify(s.token) + ');const originalFetch=window.fetch;window.fetch=async(...args)=>{const r=await originalFetch(...args);try{const d=await r.clone().json();if(d.player)window.snap=d;}catch{}return r;};'
		});
		pages.push(p);
		await p.wait('!!window.unityInstance', 120000);
		await p.wait('window.snap?.match?.phase==="setup"', 30000);
	}
	assert.deepEqual(pages.map(count), [0, 0]);
	seats.forEach((s, i) => a.call('setup', {
		ranks: generateFormation(19 + i)
	}, s.token));
	await until(() => count(pages[0]) === 1, 'first own turn');
	await sleep(450);
	await pages[0].screenshot(evidence + '/first-turn.png');
	console.log('EARLY_SCREENSHOT ' + evidence + '/first-turn.png');
	await sleep(2600);
	assert.equal(count(pages[1]), 0);
	for (const [width, height] of [[1920, 900], [1366, 768], [900, 850]]) {
		await pages[0].call('Emulation.setDeviceMetricsOverride', {
			width, height, deviceScaleFactor: 1, mobile: false
		});
		await sleep(600);
		await pages[0].screenshot(evidence + '/header-' + width + 'x' + height + '.png');
	}
	await pages[0].call('Emulation.setDeviceMetricsOverride', {
		width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false
	});
	// Only isolated fixture changes below. Generate an opponent-to-own transition in each browser.
	m.board.fill(null);
	m.board[60] = {
		side: 0, rank: '2', id: 'r'
	};
	m.board[30] = {
		side: 1, rank: '4', id: 'b'
	};
	m.board[0] = {
		side: 1, rank: '2', id: 'bspare'
	};
	m.board[99] = {
		side: 0, rank: '4', id: 'rspare'
	};
	m.selection = null;
	m.history = [[], []];
	m.turn = 1;
	await until(() => count(pages[1]) === 1, 'blue turn');
	await sleep(350);
	await pages[1].screenshot(evidence + '/blue-turn.png');
	m.turn = 0;
	await until(() => count(pages[0]) === 2, 'red next turn');
	await pages[1].wait('window.snap?.match?.turn===0', 10000);
	await sleep(350);
	// Click selection through the active visual overlay, then legal move; banner must not intercept input.
	await click(pages[0], ...point(60));
	await until(() => m.selection?.from === 60, 'click through turn banner');
	const blueBeforeMove = count(pages[1]);
	await click(pages[0], ...point(50, 0, false));
	await until(() => m.board[50]?.side === 0, 'actual Unity move');
	await sleep(700);
	assert.equal(count(pages[1]), blueBeforeMove, 'notice waits for move animation');
	await pages[0].screenshot(evidence + '/after-move-opponent-turn.png');
	await until(() => count(pages[1]) === blueBeforeMove + 1, 'opponent move animation then notice');
	await sleep(2300);
	const before = pages.map(count);
	a.call('teacher/pause', {}, 'fixture');
	await sleep(1600);
	a.call('teacher/resume', {}, 'fixture');
	await sleep(1700);
	assert.deepEqual(pages.map(count), before, 'pause/resume no repeat');
	await pages[1].call('Page.reload');
	await pages[1].wait('!!window.unityInstance', 120000);
	await pages[1].wait('window.snap?.match?.phase==="play"', 30000);
	await sleep(1700);
	assert.equal(count(pages[1]), before[1], 'own turn reload no repeat');
	// A combat flips turn immediately, but no banner until BOTH manual Continue acknowledgments clear.
	m.board.fill(null);
	m.board[60] = {
		side: 0, rank: '4', id: 'ra'
	};
	m.board[50] = {
		side: 1, rank: '2', id: 'bd'
	};
	m.board[0] = {
		side: 1, rank: '2', id: 'bs'
	};
	m.board[99] = {
		side: 0, rank: '4', id: 'rs'
	};
	m.turn = 0;
	m.selection = null;
	m.history = [[], []];
	await sleep(3500);
	const blueBefore = count(pages[1]);
	a.call('move', {
		from: 60, to: 50, seq: m.seq, requestId: 'battle'
	}, seats[0].token);
	await sleep(5000);
	assert.equal(count(pages[1]), blueBefore, 'reveal suppresses turn notice');
	await click(pages[0], 590, 671);
	await until(() => m.reveal?.ack[0], 'red manual Continue');
	await sleep(1500);
	assert.equal(count(pages[1]), blueBefore, 'other Continue still pending');
	await click(pages[1], 590, 671);
	await until(() => !m.reveal, 'blue manual Continue');
	await until(() => count(pages[1]) === blueBefore + 1, 'turn after both manual Continue');
	await sleep(350);
	await pages[1].screenshot(evidence + '/after-both-continue.png');
	await sleep(2300);
	for (let i = 0; i < 32; i++)
		m.events.push({
			seq: m.seq, kind: 'note', text: (i === 0 ? 'FIRST RECORD' : i === 31 ? 'LAST RECORD' : 'Dispatch ' + i) + ' - Public strategy record retained in the scrollable history.', side: 0
		});
	await sleep(1600);
	await click(pages[0], 1095, 205);
	await sleep(600);
	assert(pages[0].logs.some(e => JSON.stringify(e).includes('SIDEBAR_TAB 1')));
	await pages[0].screenshot(evidence + '/dispatch-history-top.png');
	const scale = 1280 / 1200;
	await pages[0].call('Input.dispatchMouseEvent', {
		type: 'mouseWheel', x: 1100 * scale, y: 500 * scale + 20, deltaX: 0, deltaY: 4000
	});
	await sleep(800);
	await pages[0].screenshot(evidence + '/dispatch-history-bottom.png');
	await sleep(1600);
	await pages[0].screenshot(evidence + '/dispatch-tab-after-polls.png');
	await click(pages[0], 970, 205);
	await sleep(400);
	await pages[0].screenshot(evidence + '/instructions-tab.png');
	await click(pages[0], 90, 866);
	await click(pages[0], 210, 866);
	assert(pages[0].logs.filter(e => JSON.stringify(e).includes('FACT_CARD')).length >= 2, 'actual fact Pause/Next buttons');
	await pages[0].screenshot(evidence + '/fact-card-paused.png');
	const facts = await pages[0].evaluate('fetch("/facts.json").then(r=>r.json())'), longest = facts.reduce((best, f, i) => f.text.length > facts[best].text.length ? i : best, 0);
	for (let n = 0; n < facts.length; n++) {
		const line = pages[0].logs.filter(e => JSON.stringify(e).includes('FACT_CARD')).at(-1), current = Number(JSON.stringify(line).match(/FACT_CARD (\d+)/)[1]);
		if (current === longest)
			break;
		await click(pages[0], 210, 866);
	}
	await sleep(400);
	await pages[0].screenshot(evidence + '/longest-fact.png');
	const teacher = await browser.page(base + '/unity/index.html?qa=1', {
		blockSdk: true
	});
	await teacher.wait('!!window.unityInstance', 120000);
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
	await sleep(2000);
	await click(teacher, 800, 231);
	await sleep(3500);
	assert.equal(count(teacher), 0, 'spectator no popup');
	await teacher.screenshot(evidence + '/spectator-header.png');
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', checks: ['both-side turn notices', 'setup to first actionable turn', 'actual Unity selection/move through passive overlay', 'pause/resume no repeat', 'reload no repeat', 'combat waits for both manual Continue', 'common and narrow header screenshots', 'persistent sidebar tabs and full scrollable public record', 'actual fact Pause/Next controls', 'no live authority touched']
	}, null, 2));
	console.log('PASS ' + evidence);
}
catch (e) {
	for (let i = 0; i < pages.length; i++)
		await pages[i].screenshot(evidence + '/failure-' + i + '.png');
	throw e;
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
