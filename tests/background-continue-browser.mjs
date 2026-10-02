import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { launchBrowser } from './browser-helper.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const a = createAuthority({
	classCode: 'BG', teacherKey: 'fixture', timedSetup: false, timedTurns: true
});
const seats = [0, 1].map(() => a.call('join', {
	classCode: 'BG'
}));
a.call('teacher/start', {}, 'fixture');
const m = [...a.matches.values()][0];
m.phase = 'play';
m.ready = [true, true];
m.board.fill(null);
for (const [i, side, rank] of [[60, 0, '4'], [50, 1, 'F'], [99, 0, 'F'], [0, 1, '2']])
	m.board[i] = {
		id: String(i), side, rank
	};
a.call('move', {
	from: 60, to: 50, seq: m.seq, requestId: 'final-background'
}, seats[0].token);
a.call('teacher/pause', {}, 'fixture');
const server = serve(a, 0, process.env.BACKGROUND_STAGE || 'Builds/CompleteArtStage');
await new Promise(r => server.on('listening', r));
const evidence = 'docs/evidence/background-continue-' + Date.now();
await mkdir(evidence, {
	recursive: true
});
let browser;
try {
	browser = await launchBrowser();
	const pages = [];
	for (const seat of seats) {
		const p = await browser.page('http://127.0.0.1:' + server.address().port + '/unity/index.html?qa=1', {
			blockSdk: true, initScript: `sessionStorage.setItem('studentToken',${JSON.stringify(seat.token)});const f=fetch;window.fetch=async(...a)=>{const r=await f(...a);try{const s=await r.clone().json();if(s.player)window.snap=s;}catch{}return r;};`
		});
		await p.call('Page.bringToFront');
		await p.call('Emulation.setFocusEmulationEnabled', {
			enabled: true
		});
		await p.wait('!!window.unityInstance', 120000);
		pages.push(p);
	}
	for (let n = 0; n < 300 && !m.continueClocks?.every(c => c); n++)
		await sleep(100);
	assert(m.continueClocks?.every(c => c), 'both actual Unity players registered rendered combat');
	await pages[0].screenshot(evidence + '/paused-final-combat.png');
	for (const p of pages)
		await p.call('Page.setWebLifecycleState', {
			state: 'frozen'
		});
	a.call('teacher/resume', {}, 'fixture');
	await sleep(2000);
	a.call('teacher/pause', {}, 'fixture');
	const remaining = m.continueClocks.map(c => c.remaining);
	assert(remaining.every(x => x > 2000 && x < 4000));
	await sleep(5500);
	assert.deepEqual(m.continueClocks.map(c => c.remaining), remaining, 'teacher pause excludes hidden time');
	assert(m.reveal);
	a.call('teacher/resume', {}, 'fixture');
	await sleep(3500);
	assert.equal(m.reveal, null, 'server advances while both browsers fully frozen');
	assert(m.events.find(e => e.kind === 'combat').ack.every(Boolean));
	for (let i = 0; i < 2; i++) {
		const p = pages[i];
		await p.call('Page.setWebLifecycleState', {
			state: 'active'
		});
		await p.call('Page.bringToFront');
		await p.call('Page.reload');
		await p.wait('!!window.unityInstance', 120000);
		await p.wait('window.snap?.match?.phase==="over" && !window.snap.match.battle', 60000);
		await sleep(5000);
		await p.screenshot(evidence + '/resumed-result-' + i + '.png');
		assert(!p.logs.some(e => e.method === 'Runtime.exceptionThrown'));
	}
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', stage: process.env.BACKGROUND_STAGE || 'Builds/CompleteArtStage', checks: ['actual Unity own rendered-ready registration', 'both pages frozen with no client execution', 'teacher pause excludes hidden time', 'server independently acknowledges each own side after five active seconds', 'final capture result survives page reload'], sdk: 'blocked fixture'
	}, null, 2));
	console.log('PASS ' + evidence);
}
finally {
	if (browser)
		if (process.env.KEEP_PREVIEW_BROWSER)
			await browser.keepPreview('http://127.0.0.1:8080/tabletop/index.html');
		else
			await browser.close();
	server.close();
}
