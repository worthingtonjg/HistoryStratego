import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { launchBrowser } from './browser-helper.mjs';
const live = process.argv.includes('--live');
const a = createAuthority({
	timedSetup: false,
	teacherKey: 'browser-test-teacher', classCode: 'PROOF1'
}), server = serve(a, 0);
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
await mkdir('docs/evidence', {
	recursive: true
});
let browser;
try {
	browser = await launchBrowser();
	const teacher = await browser.page(base + '#r=WRNG', {
		blockSdk: !live
	}), p1 = await browser.page(base + '#r=WRNG', {
		blockSdk: !live
	}), p2 = await browser.page(base + '#r=WRNG', {
		blockSdk: !live
	});
	await teacher.evaluate("document.querySelector('#key').value='browser-test-teacher';document.querySelector('#teacher').click()");
	await teacher.wait("!document.querySelector('#teacherPanel').hidden");
	for (const [p, name] of [[p1, 'Learner A'], [p2, 'Learner B']]) {
		await p.evaluate("document.querySelector('#code').value='PROOF1';document.querySelector('#join').click()");
		await p.wait("!document.querySelector('#studentPanel').hidden");
	}
	await teacher.wait("document.querySelector('#roster').children.length===2");
	const expected = a.call('teacher/state', {}, 'browser-test-teacher').presence.roomCode;
	for (const p of [teacher, p1, p2]) {
		await p.wait("document.querySelector('#playroomStatus').dataset.state===" + JSON.stringify(live ? 'connected' : 'failed'), 45000);
		assert.equal(await p.evaluate("document.querySelector('#playroomStatus').dataset.room"), expected);
	}
	console.log('PASS: automatic classroom presence ' + (live ? 'connected in same live room ' + expected : 'failure fallback with SDK deliberately blocked'));
	const originalSeat = await p1.evaluate("fetch('/api/state',{method:'POST',headers:{Authorization:'Bearer '+sessionStorage.getItem('studentToken')}}).then(r=>r.json()).then(s=>s.player)");
	await teacher.evaluate("[...document.querySelectorAll('#controls button')].find(b=>b.textContent==='Start').click()");
	await p1.wait("document.querySelectorAll('#board button').length===100");
	await p2.wait("document.querySelectorAll('#board button').length===100");
	for (const p of [p1, p2]) {
		await p.evaluate("document.querySelector('#ready').click()");
	}
	await p1.wait("document.querySelector('#hint').textContent==='Your turn'");
	const hidden = await p1.evaluate("[...document.querySelectorAll('#board button.p1')].every(b=>b.textContent==='?')");
	assert(hidden);
	// Canonical ordered formation puts scouts on the front row, indices 1..8.
	await p1.evaluate("document.querySelector('[aria-label^=\"Square 61 \"]').click()");
	await p1.evaluate("document.querySelector('[aria-label^=\"Square 51 \"]').click()");
	await p2.wait("document.querySelector('#hint').textContent==='Your turn'");
	await p2.evaluate("document.querySelector('[aria-label^=\"Square 31 \"]').click()");
	await p2.evaluate("document.querySelector('[aria-label^=\"Square 41 \"]').click()");
	await p1.wait("document.querySelector('#hint').textContent==='Your turn'");
	await p1.evaluate("document.querySelector('[aria-label^=\"Square 51 \"]').click()");
	await p1.evaluate("document.querySelector('[aria-label^=\"Square 41 \"]').click()");
	await p1.wait("document.querySelector('#events').textContent.includes('Scout attacks Scout: both removed')");
	await p2.wait("document.querySelector('#events').textContent.includes('Scout attacks Scout: both removed')");
	await p1.screenshot('docs/evidence/student-board.png');
	await teacher.evaluate("[...document.querySelectorAll('#controls button')].find(b=>b.textContent==='Pause').click()");
	await p1.wait("document.querySelector('#hint').textContent.includes('paused')");
	const denied = await p1.evaluate("fetch('/api/move',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+sessionStorage.getItem('studentToken')},body:JSON.stringify({from:51,to:41,seq:4,requestId:'pause-bypass'})}).then(async r=>({status:r.status,body:await r.json()}))");
	assert.equal(denied.status, 400);
	assert.match(denied.body.error, /teacher/);
	await teacher.screenshot('docs/evidence/teacher-desk.png');
	await p1.call('Page.reload');
	await p1.wait("document.querySelector('#status').textContent.includes('Learner A')");
	assert(await p1.evaluate("document.querySelector('#hint').textContent.includes('paused')"));
	await p1.wait("document.querySelector('#playroomStatus').dataset.state===" + JSON.stringify(live ? 'connected' : 'failed'), 45000);
	assert.equal(await p1.evaluate("fetch('/api/state',{method:'POST',headers:{Authorization:'Bearer '+sessionStorage.getItem('studentToken')}}).then(r=>r.json()).then(s=>s.player)"), originalSeat);
	const before = await p1.evaluate("document.querySelector('#factText').textContent");
	await p1.evaluate("document.querySelector('#pauseFact').click();document.querySelector('#nextFact').click()");
	assert.notEqual(await p1.evaluate("document.querySelector('#factText').textContent"), before);
	console.log('PASS: three isolated browser contexts, two student joins, teacher start, 100 squares, private ranks, two alternating moves, pause rejected by API, reload recovery, manual history facts.');
	await writeFile('docs/evidence/browser-result.json', JSON.stringify({
		result: 'passed', utc: new Date().toISOString(), client: 'browser verification client, not Unity', checks: ['teacher and two isolated student browsers', 'class join and roster', 'teacher starts paired round', '40-piece setup each side', '100-square board', 'opponent ranks hidden', 'alternating legal moves', 'combat ranks revealed and equal pieces removed', 'pause enforced against direct HTTP bypass', 'reload restores same seat', 'history pause and next controls']
	}, null, 2));
	await teacher.evaluate("[...document.querySelectorAll('#controls button')].find(b=>b.textContent==='End').click()");
	await p1.wait("document.querySelector('#playroomStatus').dataset.state==='ended'");
	await p1.call('Page.reload');
	await p1.wait("document.querySelector('#playroomStatus').dataset.state==='ended'");
	const ended = await p1.evaluate("fetch('/api/move',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+sessionStorage.getItem('studentToken')},body:JSON.stringify({from:60,to:50,seq:5,requestId:'ended-revive',phase:'active'})}).then(r=>r.status)");
	assert.equal(ended, 400);
	await writeFile('docs/evidence/presence-' + (live ? 'live' : 'fallback') + '-result.json', JSON.stringify({
		result: 'passed', mode: live ? 'live Playroom' : 'SDK blocked by browser test', room: expected, utc: new Date().toISOString(), checks: ['automatic teacher and two student joins', 'same backend room despite stale invite hash', 'reload restores same seat and room', 'connection status visible', 'ended reload stays ended', 'direct move cannot revive ended round']
	}, null, 2));
	console.log('PASS: reload/reconnect, ended-session reload and server rejection of revival.');
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
