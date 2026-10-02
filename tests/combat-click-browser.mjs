import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { generateFormation } from '../web/formation.mjs';
import { launchBrowser } from './browser-helper.mjs';
const a = createAuthority({
	timedSetup: false,
	classCode: 'CLICK', teacherKey: 'fixture'
}), seats = ['Jon', 'Computer'].map(name => a.call('join', {
	classCode: 'CLICK', name
}));
a.call('teacher/start', {}, 'fixture');
const m = [...a.matches.values()][0];
const server = serve(a, 0, 'Builds/ClickStage');
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port, evidence = 'docs/evidence/click-run-' + Date.now(), sleep = ms => new Promise(r => setTimeout(r, ms));
let browser, teacher;
const pages = [];
const count = (p, text) => p.logs.filter(e => e.method === 'Runtime.consoleAPICalled' && JSON.stringify(e.params).includes(text)).length;
async function until(fn, label, ms = 25000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (fn())
			return;
		await sleep(100);
	}
	throw Error('Timeout ' + label);
}
async function mouse(p, type, x, y, clickCount = 1) {
	const scale = 1280 / 1200;
	await p.call('Input.dispatchMouseEvent', {
		type, x: x * scale, y: y * scale + 20, button: 'left', clickCount
	});
	await sleep(100);
}
async function click(p, x, y, n = 1) {
	await mouse(p, 'mousePressed', x, y, n);
	await mouse(p, 'mouseReleased', x, y, n);
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
function fixture(attacker = '2', defender = '4') {
	assert(!m.reveal);
	m.board.fill(null);
	m.phase = 'play';
	m.winner = -1;
	m.turn = 0;
	m.selection = null;
	m.history = [[], []];
	m.board[60] = {
		side: 0, rank: attacker, id: 'attack'
	};
	m.board[50] = {
		side: 1, rank: defender, id: 'defend'
	};
	m.board[99] = {
		side: 0, rank: '2', id: 'r'
	};
	m.board[0] = {
		side: 1, rank: '2', id: 'b'
	};
	a.call('move', {
		from: 60, to: 50, seq: m.seq, requestId: 'fixture-' + m.seq
	}, seats[0].token);
}
async function rendered() {
	await until(() => pages.every(p => count(p, 'BATTLE_BANTER ' + m.reveal.seq + ' ') > 0), 'both battle presentations');
}
try {
	await mkdir(evidence, {
		recursive: true
	});
	browser = await launchBrowser();
	for (const seat of seats) {
		const init = 'sessionStorage.setItem("studentToken",' + JSON.stringify(seat.token) + ');window.ackRequests=0;window.sourceOpens=[];window.open=(url)=>{window.sourceOpens.push(url);return null;};const originalFetch=window.fetch;window.fetch=async(...args)=>{if(String(args[0]).includes("/api/state")&&window.delayState){window.delayState=false;window.pollStarted=true;await new Promise(r=>setTimeout(r,2500));}if(String(args[0]).includes("/api/ack"))window.ackRequests++;const response=await originalFetch(...args);try{const d=await response.clone().json();if(d.player)window.snap=d;}catch{}return response;};';
		const p = await browser.page(base + '/unity/index.html?qa=1', {
			blockSdk: true, initScript: init
		});
		pages.push(p);
		await p.wait('!!window.unityInstance', 120000);
		await p.wait('window.snap?.match?.phase==="setup"', 30000);
	}
	assert(pages.every(p => count(p, 'SIDEBAR_MATCH_STARTED') === 0));
	a.call('setup', {
		ranks: generateFormation(19)
	}, seats[0].token);
	await sleep(1700);
	assert(pages.every(p => count(p, 'SIDEBAR_MATCH_STARTED') === 0), 'first lock does not switch tabs');
	a.call('setup', {
		ranks: generateFormation(20)
	}, seats[1].token);
	await until(() => pages.every(p => count(p, 'SIDEBAR_MATCH_STARTED') === 1), 'both locks switch once');
	await click(pages[0], 965, 205);
	await sleep(1800);
	assert.equal(count(pages[0], 'SIDEBAR_MATCH_STARTED'), 1);
	await pages[0].screenshot(evidence + '/manual-tab-after-polls.png');
	teacher = await browser.page(base + '/unity/index.html?qa=1', {
		blockSdk: true
	});
	await teacher.wait('!!window.unityInstance', 120000);
	await type(teacher, 400, 273, 'fixture');
	await click(teacher, 400, 316);
	await sleep(1700);
	await click(teacher, 800, 231);
	await sleep(1700);
	await mouse(pages[0], 'mousePressed', 100, 115);
	fixture();
	await rendered();
	await click(pages[1], 100, 400);
	await click(pages[1], 100, 400, 2);
	assert.deepEqual(m.reveal.ack, [false, false], 'early rapid double click ignored');
	await sleep(3200);
	await mouse(pages[0], 'mouseReleased', 100, 115);
	assert.deepEqual(m.reveal.ack, [false, false], 'held opening gesture ignored');
	await click(teacher, 200, 400);
	assert.deepEqual(m.reveal.ack, [false, false], 'spectator click never acknowledges');
	await pages[0].screenshot(evidence + '/click-anywhere-quote-border.png');
	console.log('EARLY_SCREENSHOT ' + evidence + '/click-anywhere-quote-border.png');
	// A valid explicit gesture queues behind an in-flight routine poll instead of getting lost.
	await pages[0].evaluate('window.pollStarted=false;window.delayState=true');
	await pages[0].wait('window.pollStarted', 10000);
	await click(pages[0], 90, 866);
	await until(() => m.reveal?.ack[0], 'click during poll delivered');
	assert.deepEqual(await pages[0].evaluate('window.sourceOpens'), [], 'dismissal did not activate source link');
	assert.equal(await pages[0].evaluate('window.ackRequests'), 1);
	assert.deepEqual(m.reveal.ack, [true, false]);
	await click(pages[0], 100, 400);
	assert.equal(await pages[0].evaluate('window.ackRequests'), 1, 'no repeat when already acknowledged');
	await click(pages[1], 200, 400);
	await until(() => !m.reveal, 'both manual clicks release barrier');
	await mouse(pages[1], 'mousePressed', 200, 600, 2);
	await mouse(pages[1], 'mouseReleased', 200, 600, 2);
	assert.equal(m.seq, 3, 'dismissal tail never moves a piece');
	fixture('3', 'B');
	a.call('teacher/pause', {}, 'fixture');
	await rendered();
	await sleep(3200);
	await pages[1].call('Page.reload');
	await pages[1].wait('!!window.unityInstance', 120000);
	await pages[1].wait('window.snap?.match?.battle?.kind==="combat"', 30000);
	await click(pages[1], 100, 400);
	assert.deepEqual(m.reveal.ack, [false, false], 'reload animation cannot be skipped');
	await sleep(3200);
	await click(pages[0], 100, 400);
	await until(() => m.reveal?.ack[0], 'paused explicit own ack');
	await click(pages[1], 100, 400);
	await until(() => !m.reveal, 'paused both ack');
	assert.equal(a.call('state', {}, seats[0].token).phase, 'paused');
	a.call('teacher/resume', {}, 'fixture');
	fixture('4', 'F');
	await rendered();
	await sleep(3200);
	assert(pages.every(p => count(p, 'ENDGAME_SCREEN') === 0), 'final battle shown before result');
	await click(pages[0], 100, 400);
	await until(() => m.reveal?.ack[0], 'flag red ack');
	assert.equal(count(pages[1], 'ENDGAME_SCREEN'), 0);
	await click(pages[1], 100, 400);
	await until(() => !m.reveal, 'flag both ack');
	await until(() => pages.every(p => count(p, 'ENDGAME_SCREEN') > 0), 'both final result screens');
	await pages[1].screenshot(evidence + '/final-result-after-both-clicks.png');
	// Another isolated match tests teacher-ended unread reveal, rather than fabricating a winner.
	a.call('teacher/end', {}, 'fixture');
	a.call('teacher/start', {}, 'fixture');
	const next = [...a.matches.values()].at(-1);
	next.phase = 'play';
	next.ready = [true, true];
	next.board[60] = {
		side: 0, rank: '4', id: 'a'
	};
	next.board[50] = {
		side: 1, rank: '2', id: 'd'
	};
	next.board[0] = {
		side: 1, rank: '2', id: 'b'
	};
	next.board[99] = {
		side: 0, rank: '2', id: 'r'
	};
	await pages[0].wait('window.snap?.match?.id===' + JSON.stringify(next.id), 10000);
	a.call('move', {
		from: 60, to: 50, seq: next.seq, requestId: 'end-battle'
	}, seats[0].token);
	a.call('teacher/end', {}, 'fixture');
	await pages[0].wait('window.snap?.phase==="ended"', 10000);
	await pages[1].wait('window.snap?.phase==="ended"', 10000);
	await sleep(5500);
	await click(pages[0], 100, 400);
	await until(() => next.reveal?.ack[0], 'ended reveal red ack');
	await click(pages[1], 100, 400);
	await until(() => !next.reveal, 'ended reveal blue ack');
	assert.equal(next.winner, -1);
	await sleep(4500);
	await click(pages[0], 100, 865);
	await pages[0].wait('window.sourceOpens.length===1', 5000);
	const links = await pages[0].evaluate('fetch("/facts.json").then(r=>r.json()).then(f=>f.map(x=>x.url))');
	assert(links.includes((await pages[0].evaluate('window.sourceOpens'))[0]), 'plain source link opens a verified fact URL');
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', checks: ['first lock stays Instructions; both locks open Dispatches once', 'fresh manual click anywhere outside old button', 'early/held/opening/double clicks ignored', 'in-flight poll queues only explicit acknowledgment', 'fact sibling control does not activate', 'own acknowledgment only; both-player barrier', 'spectator click is read-only', 'paused/reloaded/teacher-ended unread reveal remains manually dismissible', 'final flag presentation before result', 'no live session touched']
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
