import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { launchBrowser } from './browser-helper.mjs';
const evidence = 'docs/evidence/cutscene-run-' + Date.now(), authority = createAuthority({
	timedSetup: false,
	classCode: 'CUT', teacherKey: 'cutscene-test'
});
const red = authority.call('join', {
	classCode: 'CUT', name: 'Alex'
}), blue = authority.call('join', {
	classCode: 'CUT', name: 'Sam'
});
authority.call('teacher/start', {}, 'cutscene-test');
const m = [...authority.matches.values()][0];
m.phase = 'play';
m.ready = [true, true];
function fixture(a, d, side = 0) {
	m.board.fill(null);
	m.phase = 'play';
	m.winner = -1;
	m.turn = side;
	m.history = [[], []];
	m.selection = null;
	m.board[side === 0 ? 60 : 30] = {
		side, rank: a, id: 'attacker'
	};
	m.board[side === 0 ? 50 : 40] = {
		side: 1 - side, rank: d, id: 'defender'
	};
	m.board[99] = {
		side: 0, rank: '2', id: 'red-spare'
	};
	m.board[0] = {
		side: 1, rank: '2', id: 'blue-spare'
	};
	authority.call('move', {
		from: side === 0 ? 60 : 30, to: side === 0 ? 50 : 40, seq: m.seq, requestId: 'fixture-' + m.seq
	}, side === 0 ? red.token : blue.token);
	authority.call('teacher/pause', {}, 'cutscene-test');
}
fixture('8', '4');
const server = serve(authority, 0, 'Builds/CutsceneStage');
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
let browser, teacher, p1, p2;
async function waitFor(fn, label, ms = 30000) {
	const until = Date.now() + ms;
	while (Date.now() < until) {
		if (fn())
			return;
		await new Promise(r => setTimeout(r, 250));
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
async function ack(p, m, side, label) {
	const until = Date.now() + 30000;
	while (m.reveal && !m.reveal.ack[side] && Date.now() < until) {
		await click(p, 580, 666);
		await new Promise(r => setTimeout(r, 1000));
	}
	assert(!m.reveal || m.reveal.ack[side], label);
}
function boardPoint(i, side = 0, piece = true) {
	const n = side === 0 ? i : 99 - i, x = n % 10 - 4.5, z = 4.5 - Math.floor(n / 10) - (piece ? .11 : 0), y = piece ? .645 : .055;
	const len = Math.hypot(13.85, 13), upY = 13 / len, upZ = 13.85 / len;
	const u = .5 + x / (9.3 * (1100 / 760)), v = .5 + ((y - 14) * upY + (z + 13) * upZ) / 9.3;
	return [25 + u * 745, 178 + (1 - v) * 515];
}
async function square(p, i, side = 0, piece = true) {
	await click(p, ...boardPoint(i, side, piece));
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
const sleep = ms => new Promise(r => setTimeout(r, ms));
const messages = p => p.logs.filter(e => e.method === 'Runtime.consoleAPICalled').flatMap(e => e.params.args.map(a => String(a.value || '')));
const seen = (p, seq) => messages(p).some(s => s.startsWith('BATTLE_BANTER ' + seq + ' '));
const phase = () => authority.call('teacher/state', {}, 'cutscene-test').phase;
async function reveal() {
	for (const p of [p1, p2, teacher])
		await waitFor(() => seen(p, m.seq), 'visible battle ' + m.seq);
	await sleep(2800);
}
async function manualContinue(p, side) {
	const until = Date.now() + 20000;
	while (m.reveal && !m.reveal.ack[side] && Date.now() < until) {
		await click(p, 600, 671);
		await sleep(700);
	}
	assert(!m.reveal || m.reveal.ack[side], 'manual Continue ' + side);
}
async function deskResume() {
	await click(teacher, 100, 151);
	await sleep(1500);
	const until = Date.now() + 15000;
	while (phase() !== 'active' && Date.now() < until) {
		await click(teacher, 555, 161);
		await sleep(700);
	}
	assert.equal(phase(), 'active');
	await click(teacher, 800, 231);
	await sleep(1800);
}
try {
	await mkdir(evidence, {
		recursive: true
	});
	browser = await launchBrowser();
	for (const [name, seat] of [['red', red], ['blue', blue]]) {
		const p = await browser.page(base + '/unity/index.html?qa=1', {
			blockSdk: true, initScript: 'sessionStorage.setItem("studentToken",' + JSON.stringify(seat.token) + ');'
		});
		await p.wait('!!window.unityInstance', 120000);
		if (name === 'red')
			p1 = p;
		else
			p2 = p;
	}
	teacher = await browser.page(base + '/unity/index.html?qa=1', {
		blockSdk: true
	});
	await teacher.wait('!!window.unityInstance', 120000);
	await type(teacher, 400, 273, 'cutscene-test');
	await click(teacher, 400, 316);
	await sleep(1600);
	await click(teacher, 800, 231);
	await reveal();
	await sleep(10000);
	assert.deepEqual(m.reveal.ack, [false, false], 'no automatic acknowledgment');
	await click(teacher, 990, 151);
	await sleep(1500);
	assert.equal(authority.call('teacher/spectate', {
		matchId: m.id
	}, 'cutscene-test').match.side, 1);
	await click(teacher, 630, 151);
	await sleep(1500);
	assert.equal(authority.call('teacher/spectate', {
		matchId: m.id
	}, 'cutscene-test').match.side, 0);
	const unchanged = JSON.stringify({
		seq: m.seq, ack: m.reveal.ack, phase: phase()
	});
	for (const [x, y] of [[1100, 371], [540, 666], [825, 151], [450, 189]])
		await click(teacher, x, y);
	assert.equal(JSON.stringify({
		seq: m.seq, ack: m.reveal.ack, phase: phase()
	}), unchanged, 'spectator cannot change match');
	authority.students.get(red.player).name = 'Alexandria McAllister';
	authority.students.get(blue.player).name = 'Christopher Longsurname';
	await sleep(1800);
	for (const [width, height] of [[1920, 900], [1366, 768], [900, 850]]) {
		await teacher.call('Emulation.setDeviceMetricsOverride', {
			width, height, deviceScaleFactor: 1, mobile: false
		});
		await sleep(1300);
		await teacher.screenshot(evidence + '/long-names-' + width + 'x' + height + '.png');
	}
	await teacher.call('Emulation.setDeviceMetricsOverride', {
		width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false
	});
	authority.students.get(red.player).name = 'Alex';
	authority.students.get(blue.player).name = 'Sam';
	await sleep(1500);
	await p1.screenshot(evidence + '/player-continue.png');
	await teacher.screenshot(evidence + '/watch-only-preview.png');
	await manualContinue(p1, 0);
	assert(m.reveal && !m.reveal.ack[1], 'first Continue retains barrier');
	p2.logs.length = 0;
	await p2.call('Page.reload');
	await p2.wait('!!window.unityInstance', 120000);
	await waitFor(() => seen(p2, m.seq), 'reload retains unread combat');
	await sleep(9000);
	assert(m.reveal && !m.reveal.ack[1], 'reload never auto-acknowledges');
	await manualContinue(p2, 1);
	assert(!m.reveal);
	assert.equal(phase(), 'paused');
	await deskResume();
	console.log('PASS manual Continue/reload barrier, watch-only perspective controls, desk-only Resume.');
	for (const [a, d, side, label] of [['10', 'B', 0, 'stationary-bomb'], ['3', 'B', 1, 'blue-miner-red-bomb'], ['4', '4', 0, 'tie-no-speaker'], ['1', '10', 1, 'blue-spy-wins']]) {
		fixture(a, d, side);
		await reveal();
		await teacher.screenshot(evidence + '/' + label + '.png');
		assert.deepEqual(m.reveal.ack, [false, false]);
		await manualContinue(p1, 0);
		await manualContinue(p2, 1);
		assert(!m.reveal);
		await deskResume();
		console.log('PASS cutscene ' + label);
	}
	fixture('2', 'F');
	await reveal();
	assert.equal(m.phase, 'over');
	for (const p of [p1, p2, teacher])
		assert(!messages(p).some(s => s.startsWith('ENDGAME_SCREEN ' + m.id)));
	await teacher.screenshot(evidence + '/final-flag-reveal.png');
	await manualContinue(p1, 0);
	assert(m.reveal);
	p2.logs.length = 0;
	await p2.call('Page.reload');
	await p2.wait('!!window.unityInstance', 120000);
	await waitFor(() => seen(p2, m.seq), 'final reveal after reconnect');
	await sleep(4000);
	assert(m.reveal && !m.reveal.ack[1]);
	await manualContinue(p2, 1);
	for (const p of [p1, p2, teacher])
		await waitFor(() => messages(p).some(s => s.startsWith('ENDGAME_SCREEN ' + m.id)), 'final result follows both manual Continues');
	await p1.screenshot(evidence + '/final-winner.png');
	await p2.screenshot(evidence + '/final-loser.png');
	await teacher.screenshot(evidence + '/final-teacher.png');
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', utc: new Date().toISOString(), build: 'Builds/CutsceneStage', checks: ['actual two Unity players and teacher', 'manual Continue required; no automatic acknowledgment', 'paused inspection and reload retain barrier', 'spectator only Watch RED/BLUE and Back to teacher desk', 'desk-only session Resume', 'long-name layout at 1920x900,1366x768,900x850', 'actual side-colored roles including blue attacker', 'bomb and tie narration without speaker', 'special outcomes retain shared caption and quote', 'final reveal survives reconnect until manual Continue', 'winner/loser/teacher results after both manual Continues'], sdk: 'deliberately blocked isolated fixture'
	}, null, 2));
	console.log('PASS final manual battle barrier before endgame.');
}
catch (e) {
	for (const [p, name] of [[teacher, 'teacher'], [p1, 'red'], [p2, 'blue']])
		if (p)
			await p.screenshot(evidence + '/failure-' + name + '.png');
	throw e;
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
