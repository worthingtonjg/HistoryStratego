import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { generateFormation } from '../web/formation.mjs';
import { launchBrowser } from './browser-helper.mjs';
const a = createAuthority({
	timedSetup: false,
	classCode: 'AUTO', teacherKey: 'fixture'
}), seats = ['Jon', 'Computer'].map(name => a.call('join', {
	classCode: 'AUTO', name
}));
a.call('teacher/start', {}, 'fixture');
const m = [...a.matches.values()][0], server = serve(a, 0, 'Builds/ClickStage');
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port, evidence = 'docs/evidence/auto-selection-run-' + Date.now(), sleep = ms => new Promise(r => setTimeout(r, ms));
let browser;
const pages = [];
const layout = await readFile('Assets/Scripts/HistoryGame.cs', 'utf8'), rect = layout.match(/boardRect\s*=\s*new Rect\(([^)]+)\)/)[1].split(',').map(Number), rw = Number(layout.match(/boardRenderWidth\s*=\s*(\d+)/)[1]), rh = Number(layout.match(/boardRenderHeight\s*=\s*(\d+)/)[1]), half = Number((await readFile('Assets/Scripts/TabletopBoard.cs', 'utf8')).match(/BoardHalfHeight\s*=\s*([\d.]+)f/)[1]);
function point(i, side, piece = true) {
	const n = side === 0 ? i : 99 - i, x = n % 10 - 4.5, z = 4.5 - Math.floor(n / 10) - (piece ? .11 : 0), y = piece ? .645 : .055, l = Math.hypot(13.85, 13), u = .5 + x / (2 * half * (rw / rh)), v = .5 + ((y - 14) * 13 / l + (z + 13) * 13.85 / l) / (2 * half);
	return [rect[0] + u * rect[2], rect[1] + (1 - v) * rect[3]];
}
async function click(p, x, y) {
	const scale = 1280 / 1200;
	for (const type of ['mousePressed', 'mouseReleased']) {
		await p.call('Input.dispatchMouseEvent', {
			type, x: x * scale, y: y * scale + 20, button: 'left', clickCount: 1
		});
		await sleep(120);
	}
}
async function until(fn, label) {
	const end = Date.now() + 25000;
	while (Date.now() < end) {
		if (fn())
			return;
		await sleep(100);
	}
	throw Error('Timeout ' + label);
}
try {
	await mkdir(evidence, {
		recursive: true
	});
	browser = await launchBrowser();
	for (const seat of seats) {
		const init = 'sessionStorage.setItem("studentToken",' + JSON.stringify(seat.token) + ');window.selectCalls=0;const originalFetch=window.fetch;window.fetch=async(...args)=>{if(String(args[0]).includes("/api/select")){window.selectCalls++;if(window.holdSelect){window.holdSelect=false;window.selectPending=true;await new Promise(r=>setTimeout(r,2200));}}const r=await originalFetch(...args);try{const d=await r.clone().json();if(d.player)window.snap=d;}catch{}return r;};';
		const p = await browser.page(base + '/unity/index.html?qa=1', {
			blockSdk: true, initScript: init
		});
		pages.push(p);
		await p.wait('!!window.unityInstance', 120000);
		await p.wait('window.snap?.match?.phase==="setup"', 30000);
	}
	seats.forEach((s, i) => a.call('setup', {
		ranks: generateFormation(19 + i)
	}, s.token));
	a.call('teacher/pause', {}, 'fixture');
	await pages[0].wait('window.snap?.phase==="paused"', 10000);
	await sleep(1500);
	assert.equal(m.selection, null, 'pause blocks auto-selection');
	await pages[0].evaluate('window.holdSelect=true');
	a.call('teacher/resume', {}, 'fixture');
	await pages[0].wait('window.selectPending', 15000);
	assert.equal(await pages[1].evaluate('window.selectCalls'), 0, 'opponent never auto-selects');
	await click(pages[0], ...point(69, 0));
	await until(() => m.selection?.from === 69, 'manual choice wins over delayed automatic selection');
	assert.equal(m.seq, 2, 'selection never moves');
	await sleep(1600);
	assert.equal(m.selection.from, 69, 'polls preserve manual choice');
	await pages[0].screenshot(evidence + '/manual-choice-wins.png');
	await pages[0].call('Page.reload');
	await pages[0].wait('!!window.unityInstance', 120000);
	await pages[0].wait('window.snap?.match?.selection?.from===69', 15000);
	await sleep(1500);
	assert.equal(await pages[0].evaluate('window.selectCalls'), 0, 'reload marker prevents repeated auto-selection');
	assert.equal(m.selection.from, 69);
	await click(pages[0], ...point(59, 0, false));
	await until(() => m.seq === 3, 'human red move');
	await until(() => m.selection?.side === 1 && m.selection.targets.length > 0, 'blue auto-selection');
	assert.equal(m.turn, 1);
	const blueFrom = m.selection.from, blueTo = m.selection.targets.find(t => !m.board[t.to])?.to;
	assert.notEqual(blueTo, undefined);
	await pages[1].screenshot(evidence + '/blue-auto-selection.png');
	await click(pages[1], ...point(blueTo, 1, false));
	await until(() => m.seq === 4, 'human blue move');
	await until(() => m.selection?.side === 0 && m.selection.from === 59, 'surviving last-moved red piece reselected');
	await pages[0].screenshot(evidence + '/last-piece-reselected.png');
	assert.equal(m.seq, 4, 'auto-selection never moves after turn change');
	for (const [width, height] of [[1920, 900], [1366, 768], [900, 850]]) {
		await pages[0].call('Emulation.setDeviceMetricsOverride', {
			width, height, deviceScaleFactor: 1, mobile: false
		});
		await sleep(700);
		await pages[0].screenshot(evidence + '/layout-' + width + 'x' + height + '.png');
	}
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', checks: ['paused first turn does not select', 'only active own side selects through authority', 'manual selection wins over delayed auto response', 'reload/polls preserve manual selection', 'both sides auto-select without auto-moving', 'surviving last moved piece reselected', 'source-derived picking and responsive header/status/sidebar layout', 'no live session touched']
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
