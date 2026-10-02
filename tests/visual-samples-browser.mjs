import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { COMMANDERS } from '../server/commanders.mjs';
import { generateFormation } from '../web/formation.mjs';
import { launchBrowser } from './browser-helper.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const a = createAuthority({
	classCode: 'ART', teacherKey: 'fixture', timedSetup: false, timedTurns: false, commanderPool: [{
		...COMMANDERS.find(c => c.id === 'robert-edward-lee'), name: 'Lee'
	}, {
		...COMMANDERS.find(c => c.id === 'ulysses-s-grant'), name: 'Grant'
	}]
});
if (process.env.LEGACY_VIEW_QA) {
	const call = a.call.bind(a);
	a.call = (...args) => {
		const result = call(...args);
		if (result?.match) {
			delete result.match.turnClock;
			delete result.match.battleContinue;
			delete result.match.setupBlocked;
			if (result.match.setup)
				delete result.match.setup.noticeRemainingMs;
		}
		return result;
	};
}
const seats = [0, 1].map(() => a.call('join', {
	classCode: 'ART'
}));
a.call('teacher/start', {}, 'fixture');
for (const s of seats)
	a.call('setup', {
		ranks: generateFormation(24680 + seats.indexOf(s))
	}, s.token);
const m = [...a.matches.values()][0];
// Fixture only: both sample faces in the viewer's own front row, concealed opponent ranks.
for (const [rank, to] of [['10', 60], ['3', 61], ...(process.env.INSPECTION_QA ? [['B', 62], ['F', 63]] : [])]) {
	const from = m.board.findIndex(p => p?.side === 0 && p.rank === rank);
	[m.board[from], m.board[to]] = [m.board[to], m.board[from]];
}
if (process.env.DETAILS_QA)
	a.call('select', {
		from: 60, seq: m.seq
	}, seats[0].token);
a.call('teacher/pause', {}, 'fixture');
const server = serve(a, 0, process.env.VISUAL_STAGE || 'Builds/VisualSamplesStage');
await new Promise(r => server.on('listening', r));
const evidence = 'docs/evidence/visual-samples-' + Date.now();
await mkdir(evidence, {
	recursive: true
});
let browser, p;
let width = 1280, height = 1000;
async function click(x, y) {
	const scale = Math.min(width / 1200, height / 900);
	for (const type of ['mousePressed', 'mouseReleased']) {
		await p.call('Input.dispatchMouseEvent', {
			type, x: x * scale + (width - 1200 * scale) / 2, y: y * scale + (height - 900 * scale) / 2, button: 'left', clickCount: 1
		});
		if (type === 'mousePressed')
			await sleep(400);
	}
	await sleep(700);
}
function point(i) {
	const x = i % 10 - 4.5, z = 4.5 - Math.floor(i / 10), l = Math.hypot(13.85, 13), u = .5 + x / (8 * (1100 / 706)), v = .5 + ((.055 - 14) * 13 / l + (z + 13) * 13.85 / l) / 8;
	return [25 + u * 865, 178 + (1 - v) * 555];
}
async function clip(i) {
	const [x, y] = point(i), s = 1280 / 1200;
	return (await p.call('Page.captureScreenshot', {
		format: 'png', clip: {
			x: x * s - 12, y: y * s + 20 - 10, width: 24, height: 20, scale: 1
		}
	})).data;
}
try {
	browser = await launchBrowser();
	p = await browser.page('http://127.0.0.1:' + server.address().port + '/unity/index.html?qa=1', {
		blockSdk: true, initScript: `sessionStorage.setItem('studentToken',${JSON.stringify(seats[0].token)});const f=fetch;window.fetch=async(...a)=>{const r=await f(...a);try{const s=await r.clone().json();if(s.player)window.snap=s;}catch{}return r;};`
	});
	await p.wait('!!window.unityInstance', 120000);
	await p.wait('!!window.snap?.match');
	await p.call('Emulation.setFocusEmulationEnabled', {
		enabled: true
	});
	await p.evaluate('window.focus();document.querySelector("canvas").focus()');
	await sleep(1500);
	await p.screenshot(evidence + '/board-1280.png');
	if (process.env.INSPECTION_QA) {
		a.call('teacher/resume', {}, 'fixture');
		await p.wait('window.snap?.phase==="active"');
		const sequence = m.seq, moveRequests = () => p.logs.filter(e => e.method === 'Network.requestWillBeSent' && e.params.request.url.endsWith('/api/move')).length;
		const beforeMoves = moveRequests();
		await click(...point(62));
		assert(p.logs.some(e => JSON.stringify(e).includes('PIECE_DETAILS B')), 'actual bomb click shows details');
		assert.equal(m.selection.from, 60, 'inspection leaves server move selection untouched');
		await p.screenshot(evidence + '/inspect-bomb.png');
		await click(...point(50));
		assert.equal(m.seq, sequence, 'empty-square click after inspection cannot move old selected piece');
		await click(...point(63));
		assert(p.logs.some(e => JSON.stringify(e).includes('PIECE_DETAILS F')), 'actual flag click shows details');
		await p.screenshot(evidence + '/inspect-flag.png');
		const closed = p.logs.filter(e => JSON.stringify(e).includes('PIECE_DETAILS_CLOSE')).length;
		await click(...point(63));
		assert(p.logs.filter(e => JSON.stringify(e).includes('PIECE_DETAILS_CLOSE')).length > closed, 'flag second click deselects');
		await click(...point(60));
		await p.wait('window.snap?.match?.selection?.from===60');
		assert.equal(moveRequests(), beforeMoves, 'inspection sends zero move requests');
		assert.throws(() => a.call('move', {
			from: 62, to: 52, seq: m.seq, requestId: 'bomb-stays'
		}, seats[0].token));
		assert.throws(() => a.call('move', {
			from: 63, to: 53, seq: m.seq, requestId: 'flag-stays'
		}, seats[0].token));
		m.turn = 1;
		await p.wait('window.snap?.match?.turn===1');
		const opens = p.logs.filter(e => JSON.stringify(e).includes('PIECE_DETAILS B')).length;
		await click(...point(62));
		assert.equal(p.logs.filter(e => JSON.stringify(e).includes('PIECE_DETAILS B')).length, opens, 'wrong-turn inspection rejected consistently');
		m.turn = 0;
		a.call('teacher/pause', {}, 'fixture');
		await sleep(1000);
	}
	if (process.env.DETAILS_QA) {
		assert(p.logs.some(e => JSON.stringify(e).includes('PIECE_DETAILS 10')), 'selected Marshal footer rendered');
		a.call('teacher/resume', {}, 'fixture');
		a.call('select', {
			from: 61, seq: m.seq
		}, seats[0].token);
		a.call('teacher/pause', {}, 'fixture');
		await sleep(1400);
		assert(p.logs.some(e => JSON.stringify(e).includes('PIECE_DETAILS 3')), 'selected Miner footer rendered');
		await p.screenshot(evidence + '/details-miner.png');
		m.selection = null;
		await sleep(1400);
		assert(p.logs.some(e => JSON.stringify(e).includes('PIECE_DETAILS_CLOSE')), 'facts restore after deselection');
		await p.screenshot(evidence + '/facts-restored.png');
	}
	if (process.env.ART_GALLERY_QA) {
		for (const rank of ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'B', 'F']) {
			const from = m.board.findIndex(p => p?.side === 0 && p.rank === rank);
			m.selection = {
				from, side: 0, seq: m.seq, targets: []
			};
			await p.wait('window.snap?.match?.selection?.from===' + from);
			await sleep(350);
			await p.screenshot(evidence + '/detail-' + rank + '.png');
			const cropped = await p.call('Page.captureScreenshot', {
				format: 'png', clip: {
					x: 27, y: 854, width: 1228, height: 115, scale: 1
				}
			});
			await writeFile(evidence + '/gallery-' + rank + '.png', Buffer.from(cropped.data, 'base64'));
		}
		m.selection = null;
		await sleep(800);
	}
	if (process.env.WATER_QA) {
		const samples = [], start = Date.now();
		for (let n = 0; n < 60; n++) {
			const t = Date.now() - start;
			samples.push({
				ms: t, hash: createHash('sha256').update(await clip(42)).digest('hex')
			});
			await sleep(500);
		}
		let longest = 0, lastChanged = samples[0].ms;
		for (let n = 1; n < samples.length; n++) {
			if (samples[n].hash !== samples[n - 1].hash)
				lastChanged = samples[n].ms;
			longest = Math.max(longest, samples[n].ms - lastChanged);
		}
		await writeFile(evidence + '/idle-water.json', JSON.stringify({
			samples, unique: new Set(samples.map(s => s.hash)).size, longestUnchangedMs: longest
		}, null, 2));
		if (process.env.WATER_EXPECT_CONTINUOUS)
			assert(longest < 1600, 'foreground idle lake never freezes for1.6seconds');
	}
	const lake = await clip(42), land = await clip(44);
	await sleep(1200);
	assert.notEqual(await clip(42), lake, 'lake surface animates');
	assert.equal(await clip(44), land, 'adjacent land and grid stay still');
	const frames = await p.evaluate('new Promise(resolve=>{const samples=[];let before=performance.now();function step(t){samples.push(t-before);before=t;if(samples.length===90)resolve(samples.slice(1));else requestAnimationFrame(step);}requestAnimationFrame(step);})');
	for (const [name, x] of [['left-portrait', 455], ['left-name', 510], ['right-portrait', process.env.UNION_LEFT_QA ? 670 : 637], ['right-name', process.env.UNION_LEFT_QA ? 715 : 700]]) {
		await click(x, 90);
		await p.screenshot(evidence + '/' + name + '-profile.png');
		await click(600, 700);
	}
	width = 900;
	height = 850;
	await p.call('Emulation.setDeviceMetricsOverride', {
		width, height, deviceScaleFactor: 1, mobile: false
	});
	await sleep(600);
	await p.screenshot(evidence + '/board-900.png');
	width = 1920;
	height = 900;
	await p.call('Emulation.setDeviceMetricsOverride', {
		width, height, deviceScaleFactor: 1, mobile: false
	});
	await sleep(600);
	await p.screenshot(evidence + '/board-1920.png');
	width = 1280;
	height = 1000;
	await p.call('Emulation.setDeviceMetricsOverride', {
		width, height, deviceScaleFactor: 1, mobile: false
	});
	if (process.env.DETAILS_QA) {
		a.call('teacher/resume', {}, 'fixture');
		a.call('select', {
			from: 61, seq: m.seq
		}, seats[0].token);
		await p.wait('window.snap?.match?.selection?.from===61');
		assert.throws(() => a.call('move', {
			from: 61, to: 60, seq: m.seq, requestId: 'invalid-details-move'
		}, seats[0].token));
		assert.equal(a.call('state', {}, seats[0].token).match.selection.from, 61, 'failed move retains selection');
		a.call('move', {
			from: 61, to: 51, seq: m.seq, requestId: 'details-quiet-move'
		}, seats[0].token);
		a.call('teacher/pause', {}, 'fixture');
		await p.wait('window.snap?.match?.turn===1 && !window.snap.match.selection');
		await sleep(700);
		await p.screenshot(evidence + '/facts-after-move.png');
		if (process.env.LEGACY_VIEW_QA)
			assert.equal(await p.evaluate('window.snap.match.turnClock'), undefined, 'legacy response has no timer fields');
	}
	if (process.env.DETAILS_QA) {
		const other = await browser.page('http://127.0.0.1:' + server.address().port + '/unity/index.html?qa=1', {
			blockSdk: true, initScript: `sessionStorage.setItem('studentToken',${JSON.stringify(seats[1].token)});const f=fetch;window.fetch=async(...a)=>{const r=await f(...a);try{const s=await r.clone().json();if(s.player)window.snap=s;}catch{}return r;};`
		});
		await other.call('Page.bringToFront');
		await other.call('Emulation.setFocusEmulationEnabled', {
			enabled: true
		});
		await other.wait('!!window.unityInstance', 120000);
		await other.wait('window.snap?.match?.side===1', 60000);
		await other.evaluate('window.focus();document.querySelector("canvas").focus()');
		await other.call('Emulation.setDeviceMetricsOverride', {
			width: 900, height: 850, deviceScaleFactor: 1, mobile: false
		});
		await sleep(2000);
		await other.screenshot(evidence + '/opposite-board-900.png');
		assert(!other.logs.some(e => JSON.stringify(e).includes('PIECE_DETAILS ')), 'opposite view does not display selected enemy identity');
		await p.call('Page.bringToFront');
	}
	// Actual authoritative combat supplies both revealed sample ranks to the cutscene.
	m.board.fill(null);
	for (const [i, side, rank] of [[60, 0, '3'], [50, 1, '10'], [99, 0, '2'], [0, 1, '2'], [98, 0, 'F'], [1, 1, 'F']])
		m.board[i] = {
			id: 'art-' + i, side, rank
		};
	m.turn = 0;
	m.history = [[], []];
	m.selection = null;
	a.call('teacher/resume', {}, 'fixture');
	a.call('move', {
		from: 60, to: 50, seq: m.seq, requestId: 'art-combat'
	}, seats[0].token);
	await p.wait('window.snap?.match?.battle?.kind==="combat"');
	for (let i = 0; i < 150 && !p.logs.some(e => JSON.stringify(e).includes('BATTLE_BANTER ' + m.seq + ' ')); i++)
		await sleep(100);
	assert(p.logs.some(e => JSON.stringify(e).includes('BATTLE_BANTER ' + m.seq + ' ')), 'actual cutscene rendered');
	if (process.env.RANK_MOTION_QA) {
		for (const [label, ms] of [['approach', 400], ['topple', 950], ['fallen', 1000]]) {
			await sleep(ms);
			await p.screenshot(evidence + '/rank-combat-' + label + '.png');
		}
	}
	a.call('teacher/pause', {}, 'fixture');
	await sleep(700);
	await p.screenshot(evidence + '/combat-samples.png');
	assert(!p.logs.some(e => e.method === 'Runtime.exceptionThrown'), 'no browser runtime exceptions');
	const result = {
		result: 'passed', stage: process.env.VISUAL_STAGE || 'Builds/VisualSamplesStage', dataSha256: createHash('sha256').update(await readFile((process.env.VISUAL_STAGE || 'Builds/VisualSamplesStage') + '/Build/' + basename(process.env.VISUAL_STAGE || 'Builds/VisualSamplesStage') + '.data')).digest('hex'), inspectionChecks: process.env.INSPECTION_QA ? ['actual Bomb and Flag clicks', 'Cannot move footer', 'toggle deselection', 'switch to movable piece', 'no API move requests or old-selection click-through', 'server rejects immobile moves', 'wrong-turn inspection rejected'] : [], detailChecks: process.env.DETAILS_QA ? ['Marshal and Miner selection footer', 'facts return on deselection and successful move', 'failed move retains selection', 'opposite side authenticated before screenshot', 'opposite side cannot display enemy details'] : [], checks: ['actual Unity own Marshal and Miner artwork, concealed enemy backs', 'animated lake pixels, stable adjacent land', 'header portrait/name profile screenshots', '900/1280/1920 layout screenshots', 'actual authoritative Miner versus Marshal combat'], frameIntervals: {
			median: frames.toSorted((a, b) => a - b)[Math.floor(frames.length / 2)], max: Math.max(...frames)
		}, note: 'software-rendered local Chrome; screenshots require visual inspection; external SDK blocked'
	};
	await writeFile(evidence + '/result.json', JSON.stringify(result, null, 2));
	console.log(evidence, JSON.stringify(result));
}
catch (e) {
	if (p)
		await p.screenshot(evidence + '/failure.png');
	console.error(evidence);
	throw e;
}
finally {
	if (browser)
		if (process.env.KEEP_PREVIEW_BROWSER)
			await browser.keepPreview('http://127.0.0.1:8080/tabletop/index.html');
		else
			await browser.close();
	server.close();
}
