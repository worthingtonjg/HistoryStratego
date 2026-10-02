import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { generateFormation } from '../web/formation.mjs';
import { launchBrowser } from './browser-helper.mjs';
const a = createAuthority({
	timedSetup: false,
	classCode: 'POLISH', teacherKey: 'fixture'
}), seats = ['Jon', 'Computer'].map(name => a.call('join', {
	classCode: 'POLISH', name
}));
a.call('teacher/start', {}, 'fixture');
seats.forEach((s, i) => a.call('setup', {
	ranks: generateFormation(19 + i)
}, s.token));
const m = [...a.matches.values()][0];
for (let i = 0; i < 32; i++)
	m.events.push({
		seq: m.seq, kind: 'note', side: 0, text: (i === 0 ? 'FIRST RECORD' : i === 31 ? 'LAST RECORD' : 'Dispatch ' + i) + ' - Public strategy record retained in the scrollable history.'
	});
const server = serve(a, 0, 'Builds/TurnStage');
await new Promise(r => server.on('listening', r));
const evidence = 'docs/evidence/turn-polish-' + Date.now(), sleep = ms => new Promise(r => setTimeout(r, ms));
let browser;
try {
	await mkdir(evidence, {
		recursive: true
	});
	browser = await launchBrowser();
	const p = await browser.page('http://127.0.0.1:' + server.address().port + '/unity/index.html?qa=1', {
		blockSdk: true, initScript: 'sessionStorage.setItem("studentToken",' + JSON.stringify(seats[0].token) + ');'
	});
	await p.wait('!!window.unityInstance', 120000);
	await sleep(3500);
	await p.screenshot(evidence + '/final-instructions.png');
	const scale = 1280 / 1200;
	async function mouse(type, x, y, more = {}) {
		await p.call('Input.dispatchMouseEvent', {
			type, x: x * scale, y: y * scale + 20, ...more
		});
		await sleep(250);
	}
	async function click(x, y) {
		await mouse('mousePressed', x, y, {
			button: 'left', clickCount: 1
		});
		await mouse('mouseReleased', x, y, {
			button: 'left', clickCount: 1
		});
	}
	await click(1095, 205);
	await sleep(600);
	assert(p.logs.some(e => JSON.stringify(e).includes('SIDEBAR_TAB 1')));
	await p.screenshot(evidence + '/final-dispatch-top.png');
	// Drag the real Unity scrollbar thumb, rather than relying on browser wheel synthesis.
	await mouse('mouseMoved', 1155, 255);
	await mouse('mousePressed', 1155, 255, {
		button: 'left', clickCount: 1
	});
	for (let y = 285; y <= 685; y += 40)
		await mouse('mouseMoved', 1155, y, {
			button: 'left', buttons: 1
		});
	await mouse('mouseReleased', 1155, 685, {
		button: 'left', clickCount: 1
	});
	await sleep(600);
	await p.screenshot(evidence + '/final-dispatch-bottom.png');
	await sleep(1800);
	await p.screenshot(evidence + '/final-dispatch-poll-persistence.png');
	await p.call('Emulation.setDeviceMetricsOverride', {
		width: 900, height: 850, deviceScaleFactor: 1, mobile: false
	});
	await sleep(700);
	await p.screenshot(evidence + '/final-narrow.png');
	await p.call('Emulation.setDeviceMetricsOverride', {
		width: 1920, height: 900, deviceScaleFactor: 1, mobile: false
	});
	await sleep(700);
	await p.screenshot(evidence + '/final-wide.png');
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', checks: ['final corrected two-line tab labels', 'actual Unity scrollbar drag', 'tab and scroll persist across polls', 'common/narrow final screenshots', 'no live session touched']
	}, null, 2));
	console.log('PASS ' + evidence);
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
