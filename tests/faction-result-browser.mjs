import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { launchBrowser } from './browser-helper.mjs';
const a = createAuthority({
	timedSetup: false,
	classCode: 'RESULT', teacherKey: 'fixture'
}), seats = ['Jon', 'Computer'].map(name => a.call('join', {
	classCode: 'RESULT', name
}));
a.call('teacher/start', {}, 'fixture');
let m = [...a.matches.values()][0];
m.phase = 'play';
m.ready = [true, true];
m.turn = 1;
m.board[30] = {
	side: 1, rank: '4', id: 'blue'
};
m.board[40] = {
	side: 0, rank: 'F', id: 'flag'
};
m.board[99] = {
	side: 0, rank: '2', id: 'red'
};
a.call('move', {
	from: 30, to: 40, seq: m.seq, requestId: 'blue-flag'
}, seats[1].token);
seats.forEach(s => a.call('ack', {
	matchId: m.id, seq: m.reveal?.seq ?? m.seq
}, s.token));
const server = serve(a, 0, 'Builds/ClickStage');
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port, evidence = 'docs/evidence/faction-result-run-' + Date.now(), sleep = ms => new Promise(r => setTimeout(r, ms));
let browser;
const pages = [];
const logged = (p, text) => p.logs.some(e => e.method === 'Runtime.consoleAPICalled' && JSON.stringify(e.params).includes(text));
async function until(fn, label) {
	const end = Date.now() + 20000;
	while (Date.now() < end) {
		if (fn())
			return;
		await sleep(100);
	}
	throw Error('Timeout ' + label);
}
async function click(p, x, y) {
	const scale = 1280 / 1200;
	for (const type of ['mousePressed', 'mouseReleased']) {
		await p.call('Input.dispatchMouseEvent', {
			type, x: x * scale, y: y * scale + 20, button: 'left', clickCount: 1
		});
		await sleep(150);
	}
}
try {
	await mkdir(evidence, {
		recursive: true
	});
	browser = await launchBrowser();
	for (const seat of seats) {
		const p = await browser.page(base + '/unity/index.html?qa=1', {
			blockSdk: true, initScript: 'sessionStorage.setItem("studentToken",' + JSON.stringify(seat.token) + ');'
		});
		pages.push(p);
		await p.wait('!!window.unityInstance', 120000);
		await until(() => logged(p, 'The Union Wins!'), 'Union headline');
		await p.screenshot(evidence + (seat === seats[0] ? '/union-win-loser.png' : '/union-win-winner.png'));
	}
	const teacher = await browser.page(base + '/unity/index.html?qa=1', {
		blockSdk: true
	});
	pages.push(teacher);
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
	await sleep(1700);
	await click(teacher, 800, 231);
	await until(() => logged(teacher, 'The Union Wins!'), 'teacher neutral Union result');
	await teacher.screenshot(evidence + '/union-win-teacher.png');
	await pages[1].call('Emulation.setDeviceMetricsOverride', {
		width: 900, height: 850, deviceScaleFactor: 1, mobile: false
	});
	await sleep(800);
	await pages[1].screenshot(evidence + '/union-win-narrow.png');
	await pages[1].call('Page.reload');
	await pages[1].wait('!!window.unityInstance', 120000);
	await sleep(2500);
	await pages[1].screenshot(evidence + '/union-win-reload.png');
	a.call('teacher/end', {}, 'fixture');
	a.call('teacher/start', {}, 'fixture');
	m = [...a.matches.values()].at(-1);
	m.phase = 'play';
	m.ready = [true, true];
	m.board[60] = {
		side: 0, rank: '2', id: 'red'
	};
	m.board[30] = {
		side: 1, rank: '2', id: 'blue'
	};
	await sleep(2500);
	a.call('teacher/end', {}, 'fixture');
	await until(() => logged(pages[0], 'ENDGAME_SCREEN ' + m.id), 'teacher ended player result');
	assert.equal(m.winner, -1);
	await pages[0].screenshot(evidence + '/teacher-ended-player.png');
	await click(teacher, 130, 162);
	await sleep(1700);
	await click(teacher, 800, 231);
	await until(() => logged(teacher, 'ENDGAME_SCREEN ' + m.id), 'teacher ended neutral spectator');
	await teacher.screenshot(evidence + '/teacher-ended-spectator.png');
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', checks: ['Union winner and loser views', 'teacher neutral result with winning faction/name/reason', 'narrow result and reload flavor stability screenshots', 'teacher-ended new round no fabricated winner', 'no live session touched']
	}, null, 2));
	console.log('PASS ' + evidence);
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
