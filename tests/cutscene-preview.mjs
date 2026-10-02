import { mkdir } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { launchBrowser } from './browser-helper.mjs';
const authority = createAuthority({
	timedSetup: false,
	classCode: 'PREVIEW', teacherKey: 'preview-only'
});
const a = authority.call('join', {
	classCode: 'PREVIEW', name: 'Alex'
}), b = authority.call('join', {
	classCode: 'PREVIEW', name: 'Sam'
});
authority.call('teacher/start', {}, 'preview-only');
const m = [...authority.matches.values()][0];
m.phase = 'play';
m.board[60] = {
	side: 0, rank: '8', id: 'a'
};
m.board[50] = {
	side: 1, rank: '4', id: 'b'
};
m.board[0] = {
	side: 1, rank: '2', id: 'spare'
};
authority.call('move', {
	from: 60, to: 50, seq: 0, requestId: 'preview'
}, a.token);
authority.call('teacher/pause', {}, 'preview-only');
const server = serve(authority, 0, 'Builds/CutsceneStage');
await new Promise(r => server.on('listening', r));
const evidence = 'docs/evidence/cutscene-preview-' + Date.now();
let browser;
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
try {
	await mkdir(evidence, {
		recursive: true
	});
	browser = await launchBrowser();
	const p = await browser.page('http://127.0.0.1:' + server.address().port + '/unity/index.html?qa=1', {
		blockSdk: true
	});
	await p.wait('!!window.unityInstance', 120000);
	await type(p, 400, 273, 'preview-only');
	await click(p, 400, 316);
	await new Promise(r => setTimeout(r, 1600));
	await click(p, 800, 231);
	await new Promise(r => setTimeout(r, 4500));
	await p.screenshot(evidence + '/paused-cutscene.png');
	console.log('ACTUAL UNITY PREVIEW ' + evidence + '/paused-cutscene.png');
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
