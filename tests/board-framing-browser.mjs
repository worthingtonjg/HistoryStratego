const halfHeight = Number((await readFile('Assets/Scripts/TabletopBoard.cs', 'utf8')).match(/BoardHalfHeight\s*=\s*([0-9.]+)f/)[1]), layout = await readFile('Assets/Scripts/HistoryGame.cs', 'utf8'), rect = layout.match(/boardRect\s*=\s*new Rect\(([^)]+)\)/)[1].split(',').map(Number), rw = Number(layout.match(/boardRenderWidth\s*=\s*(\d+)/)[1]), rh = Number(layout.match(/boardRenderHeight\s*=\s*(\d+)/)[1]);
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { generateFormation } from '../web/formation.mjs';
import { launchBrowser } from './browser-helper.mjs';
const authority = createAuthority({
	timedSetup: false,
	classCode: 'BOARD', teacherKey: 'board-test'
}), seats = ['Alex', 'Sam'].map(name => authority.call('join', {
	classCode: 'BOARD', name
}));
authority.call('teacher/start', {}, 'board-test');
seats.forEach((s, i) => authority.call('setup', {
	ranks: generateFormation(19 + i)
}, s.token));
authority.call('teacher/pause', {}, 'board-test');
const m = [...authority.matches.values()][0], server = serve(authority, 0, 'Builds/TurnStage');
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port, evidence = 'docs/evidence/board-framing-run-' + Date.now();
let browser, pages = [];
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
	const u = .5 + x / ((2 * halfHeight) * (rw / rh)), v = .5 + ((y - 14) * upY + (z + 13) * upZ) / (2 * halfHeight);
	return [rect[0] + u * rect[2], rect[1] + (1 - v) * rect[3]];
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
try {
	await mkdir(evidence, {
		recursive: true
	});
	browser = await launchBrowser();
	for (const [side, seat] of seats.entries()) {
		const p = await browser.page(base + '/unity/index.html?qa=1', {
			blockSdk: true, initScript: 'sessionStorage.setItem("studentToken",' + JSON.stringify(seat.token) + ');const originalFetch=window.fetch;window.fetch=async function(...args){const response=await originalFetch(...args);try{const data=await response.clone().json();if(data.player)window.__boardSnapshot=data;}catch{}return response;};'
		});
		pages.push(p);
		await p.wait('!!window.unityInstance', 120000);
		await p.wait('window.__boardSnapshot?.match?.board?.filter(Boolean).length===80', 30000);
		await sleep(1600);
		await p.screenshot(evidence + '/full-armies-side' + side + '.png');
	}
	for (const [width, height] of [[1920, 900], [1366, 768], [900, 850]]) {
		await pages[0].call('Emulation.setDeviceMetricsOverride', {
			width, height, deviceScaleFactor: 1, mobile: false
		});
		await sleep(1500);
		await pages[0].screenshot(evidence + '/full-board-' + width + 'x' + height + '.png');
	}
	await pages[0].call('Emulation.setDeviceMetricsOverride', {
		width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false
	});
	authority.call('teacher/resume', {}, 'board-test');
	for (const side of [0, 1]) {
		m.board.fill(null);
		m.turn = side;
		m.phase = 'play';
		m.history = [[], []];
		m.selection = null;
		for (const i of [0, 9, 90, 99])
			m.board[i] = {
				side, rank: '2', id: 'corner-' + side + '-' + i
			};
		m.board[55] = {
			side: 1 - side, rank: '2', id: 'opponent'
		};
		await sleep(3800);
		for (const i of [0, 9, 90, 99]) {
			const until = Date.now() + 10000;
			while (m.selection?.from !== i && Date.now() < until) {
				await square(pages[side], i, side);
				await sleep(500);
			}
			assert.equal(m.selection?.from, i, 'actual Unity corner pick ' + side + ':' + i);
		}
		await pages[side].screenshot(evidence + '/four-corners-picked-side' + side + '.png');
		const from = side === 0 ? 99 : 0, to = side === 0 ? 89 : 10;
		await square(pages[side], from, side);
		await waitFor(() => m.selection?.from === from, 'select moving corner');
		const before = m.seq;
		await square(pages[side], to, side, false);
		await waitFor(() => m.seq === before + 1, 'corner legal move');
		assert.equal(m.board[to]?.side, side);
		assert.equal(m.board[from], null);
	}
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', utc: new Date().toISOString(), halfHeight, checks: ['actual Unity full 80-piece board in both player orientations', 'common and narrow viewport screenshots', 'all four canonical corners selected through canvas in both orientations', 'legal highlighted corner move through canvas in both orientations', 'source-aligned camera projection with actual server selection assertions', 'no live classroom touched']
	}, null, 2));
	console.log('PASS enlarged board: full formations, all four corner picks and legal moves in both orientations.');
}
catch (e) {
	for (let i = 0; i < pages.length; i++)
		await pages[i].screenshot(evidence + '/failure' + i + '.png');
	throw e;
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
