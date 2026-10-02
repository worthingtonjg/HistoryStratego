import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { generateFormation } from '../web/formation.mjs';
import { launchBrowser } from './browser-helper.mjs';
const a = createAuthority({
	classCode: 'REMIND', teacherKey: 'fixture', timedSetup: false
}), seats = [0, 1].map(() => a.call('join', {
	classCode: 'REMIND'
}));
const stage = 'Builds/ReminderStage', evidence = 'docs/evidence/reminder-run-' + Date.now(), sleep = ms => new Promise(r => setTimeout(r, ms));
await mkdir(evidence, {
	recursive: true
});
await writeFile(stage + '/reminder-frame.html', '<!doctype html><style>html,body{margin:0;height:100%;overflow:hidden}iframe{width:100%;height:100%;border:0;display:block}</style><button style="position:fixed;left:0;top:0;width:24px;height:24px;z-index:2">.</button><iframe src="index.html?qa=1"></iframe>');
const server = serve(a, 0, stage);
await new Promise(r => server.on('listening', r));
let browser, p;
const count = word => p.logs.filter(e => e.method === 'Runtime.consoleAPICalled' && JSON.stringify(e.params).includes(word)).length;
async function until(fn, label, ms = 30000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (await fn())
			return;
		await sleep(50);
	}
	throw Error('Timeout ' + label);
}
async function click(x, y, width, height) {
	const scale = Math.min(width / 1200, height / 900);
	x = x * scale + (width - 1200 * scale) / 2;
	y = y * scale + (height - 900 * scale) / 2;
	for (const type of ['mousePressed', 'mouseReleased'])
		await p.call('Input.dispatchMouseEvent', {
			type, x, y, button: 'left', clickCount: 1
		});
}
function point(i) {
	const x = i % 10 - 4.5, z = 4.5 - Math.floor(i / 10) - .11, l = Math.hypot(13.85, 13), u = .5 + x / (8 * (1100 / 706)), v = .5 + ((.645 - 14) * 13 / l + (z + 13) * 13.85 / l) / 8;
	return [25 + u * 865, 178 + (1 - v) * 555];
}
function start() {
	a.call('teacher/start', {}, 'fixture');
	for (const s of seats)
		a.call('setup', {
			ranks: generateFormation()
		}, s.token);
	const m = [...a.matches.values()][0];
	m.board.fill(null);
	for (const [i, side, rank] of [[50, 0, '4'], [90, 0, '2'], [99, 0, 'F'], [20, 1, '5'], [0, 1, 'F']])
		m.board[i] = {
			id: 'p' + i, side, rank
		};
	m.turn = 1;
	return m;
}
try {
	let m = start();
	browser = await launchBrowser();
	p = await browser.page('http://127.0.0.1:' + server.address().port + '/unity/reminder-frame.html', {
		width: 1920, height: 900, blockSdk: true, initScript: `sessionStorage.setItem('studentToken',${JSON.stringify(seats[0].token)});if(window!==parent)parent.gameFrame=window;const f=fetch;window.fetch=async(...args)=>{const r=await f(...args);try{const s=await r.clone().json();if(s.player)window.snap=s;}catch{}return r;};`
	});
	await p.wait('!!window.gameFrame?.unityInstance', 120000);
	await p.call('Emulation.setFocusEmulationEnabled', {
		enabled: true
	});
	await p.evaluate('window.gameFrame.focus();window.gameFrame.document.querySelector("canvas").focus()');
	await p.wait('window.gameFrame.snap?.match?.turn===1');
	m.turn = 0;
	await until(() => count('YOUR_TURN_NOTICE') === 1, 'first own turn');
	await sleep(3000);
	for (const type of ['mousePressed', 'mouseReleased'])
		await p.call('Input.dispatchMouseEvent', {
			type, x: 8, y: 8, button: 'left', clickCount: 1
		});
	await p.wait('!window.gameFrame.document.hasFocus()');
	await sleep(15000);
	assert.equal(count('REMINDER_OPEN'), 0, 'no trigger from unfocused time');
	await p.evaluate('window.gameFrame.focus();window.gameFrame.document.querySelector("canvas").focus()');
	await until(() => count('REMINDER_OPEN') === 1, 'fifteen eligible seconds');
	await p.screenshot(evidence + '/panel-1920.png');
	await click(...point(50), 1920, 900);
	await until(() => m.selection?.from === 50, 'selection through nonblocking panel', 2000);
	a.call('teacher/pause', {}, 'fixture');
	await p.wait('window.gameFrame.snap?.phase==="paused"');
	await sleep(4000);
	await p.screenshot(evidence + '/teacher-paused-no-panel.png');
	a.call('teacher/resume', {}, 'fixture');
	await until(() => count('REMINDER_OPEN') === 2, 'remaining panel time after pause');
	await until(() => count('REMINDER_CLOSE') === 2, 'automatic close', 6000);
	await sleep(5000);
	assert.equal(count('REMINDER_OPEN'), 2, 'no same-turn spam');
	assert.equal(m.seq, 2, 'reminder and selection never move');
	a.call('teacher/end', {}, 'fixture');
	a.call('state', {}, seats[0].token);
	a.call('state', {}, seats[1].token);
	m = start();
	await p.wait('window.gameFrame.snap?.match?.id===' + JSON.stringify(m.id) + ' && window.gameFrame.snap.match.turn===1');
	m.turn = 0;
	await p.call('Emulation.setDeviceMetricsOverride', {
		width: 900, height: 850, deviceScaleFactor: 1, mobile: false
	});
	await until(() => count('REMINDER_OPEN') === 3, 'new-turn narrow reminder');
	const shown = Date.now();
	await p.screenshot(evidence + '/panel-900.png');
	await until(() => count('REMINDER_CLOSE') === 3, 'three-second close', 6000);
	const duration = Date.now() - shown;
	assert(duration >= 2300 && duration < 4200, 'three-second visible duration ' + duration);
	await p.screenshot(evidence + '/panel-closed-900.png');
	await sleep(5000);
	assert.equal(count('REMINDER_OPEN'), 3);
	assert.equal(m.seq, 2);
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', visibleDurationMs: duration, checks: ['actual Unity 1920 and narrow layouts', '15 eligible seconds', 'focus time excluded', 'teacher pause preserves remaining panel time', 'selection passes through panel', 'three-second automatic close', 'no move or repeat', 'next-round reset']
	}, null, 2));
	console.log('PASS ' + evidence);
}
catch (e) {
	if (p)
		await p.screenshot(evidence + '/failure.png');
	console.error(evidence);
	throw e;
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
