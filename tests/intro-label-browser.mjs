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
const m = [...a.matches.values()][0], server = serve(a, 0, 'Builds/IntroductionStage');
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port, evidence = 'docs/evidence/intro-label-run-' + Date.now();
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
	await sleep(2300);
	await pages[0].screenshot(evidence + '/small-label-after-banner.png');
	assert.equal(count(pages[0]), 1);
	await sleep(1500);
	assert.equal(count(pages[0]), 1, 'polling never retriggers the banner');
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', checks: ['actual Unity first-turn notice', 'large then small label screenshots', 'no poll retrigger']
	}, null, 2));
	console.log('PASS ' + evidence);
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
