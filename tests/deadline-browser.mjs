import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { launchBrowser } from './browser-helper.mjs';
const a = createAuthority({
	classCode: 'CLOCK', teacherKey: 'fixture'
}), seats = [0, 1].map(() => a.call('join', {
	classCode: 'CLOCK'
}));
a.call('teacher/start', {}, 'fixture');
let m = [...a.matches.values()][0];
const server = serve(a, 0, process.env.DEADLINE_STAGE || 'Builds/DeadlineAlphaStage');
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port, evidence = 'docs/evidence/deadline-' + Date.now(), sleep = ms => new Promise(r => setTimeout(r, ms));
await mkdir(evidence, {
	recursive: true
});
let browser, ps = [];
async function until(fn, label, ms = 20000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (await fn())
			return;
		await sleep(100);
	}
	throw Error('Timeout ' + label);
}
const logs = p => p.logs.filter(e => e.method === 'Runtime.consoleAPICalled').flatMap(e => e.params.args.map(a => String(a.value || '')));
async function focus(p) {
	await p.call('Emulation.setFocusEmulationEnabled', {
		enabled: true
	});
	await p.call('Page.bringToFront');
	await p.evaluate('window.focus();document.querySelector("canvas").focus()');
}
async function click(p, x, y) {
	await focus(p);
	await sleep(500);
	for (const type of ['mousePressed', 'mouseReleased']) {
		await p.call('Input.dispatchMouseEvent', {
			type, x: x * 1280 / 1200, y: y * 1280 / 1200 + 20, button: 'left', clickCount: 1
		});
		await sleep(400);
	}
	await sleep(150);
}
async function reload(p) {
	await p.call('Page.reload');
	await p.wait('!!window.unityInstance', 120000);
	await p.wait('!!window.snap?.match');
	await focus(p);
}
async function request(p, route, body) {
	return p.evaluate(`fetch('/api/${route}',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+sessionStorage.getItem('studentToken')},body:${JSON.stringify(JSON.stringify(body))}}).then(r=>r.json())`);
}
try {
	browser = await launchBrowser();
	for (const s of seats) {
		const p = await browser.page(base + '/unity/index.html?qa=1', {
			blockSdk: true, initScript: `sessionStorage.setItem('studentToken',${JSON.stringify(s.token)});window.calls=[];const f=fetch;window.fetch=async(...a)=>{window.calls.push(String(a[0]));const r=await f(...a);try{const s=await r.clone().json();if(s.player)window.snap=s;}catch{}return r;};`
		});
		await p.wait('!!window.unityInstance', 120000);
		await p.wait('!!window.snap?.match');
		await focus(p);
		ps.push(p);
	}
	const [p0, p1] = ps;
	await p0.screenshot(evidence + '/versus-objective.png');
	// Own real Start button; opponent locks early and must not get an expiry notice.
	await click(p0, 600, 794);
	await p0.wait('window.snap.match.setup.started');
	a.call('setup/begin', {
		matchId: m.id
	}, seats[1].token);
	a.call('setup', {
		matchId: m.id, revision: 0
	}, seats[1].token);
	m.setupClocks[0].deadline = Date.now() + 600;
	await until(() => logs(p0).some(s => s.startsWith('DEADLINE_NOTICE ' + m.id + ':setup')), 'setup notice');
	assert(m.ready.every(Boolean));
	assert(m.setupClocks[0].noticeRemaining > 0);
	assert.equal(m.seq, 2);
	a.call('teacher/pause', {}, 'fixture');
	await p0.wait('window.snap.phase==="paused"');
	const frozen = m.setupClocks[0].noticeRemaining;
	await sleep(1200);
	assert.equal(m.setupClocks[0].noticeRemaining, frozen);
	await p0.screenshot(evidence + '/setup-times-up.png');
	assert(!logs(p1).some(s => s.startsWith('DEADLINE_NOTICE ' + m.id + ':setup')), 'manual lock no expiry notice');
	const before = await p0.evaluate('window.calls.length');
	await click(p0, 160, 560);
	assert(!(await p0.evaluate('window.calls.slice(' + before + ')')).some(x => /\/(move|select)$/.test(x)));
	await reload(p0);
	await until(() => logs(p0).filter(s => s.startsWith('DEADLINE_NOTICE ' + m.id + ':setup')).length >= 2, 'setup reload');
	a.call('teacher/resume', {}, 'fixture');
	await until(() => m.setupClocks[0].noticeRemaining === 0, 'setup notice ends');
	await p0.wait('!window.snap.match.setupBlocked');
	await until(() => m.turnClock?.banner === 0, 'initial turn grace');
	// Reach15s without waiting through unrelated opening time; server still owns real countdown.
	m.turnClock.remaining = 15500;
	await until(() => logs(p0).some(s => s.startsWith('REMINDER_OPEN')), 'server15second reminder');
	await p0.screenshot(evidence + '/fifteen-second-reminder.png');
	a.call('teacher/pause', {}, 'fixture');
	const time = m.turnClock.remaining;
	await sleep(1200);
	assert.equal(m.turnClock.remaining, time);
	a.call('teacher/resume', {}, 'fixture');
	m.board.fill(null);
	for (const [i, side, rank] of [[60, 0, '4'], [99, 0, 'F'], [0, 1, '2'], [9, 1, 'F']])
		m.board[i] = {
			id: 'quiet-' + i, side, rank
		};
	m.selection = null;
	m.turnClock.remaining = 500;
	await until(() => logs(p0).some(s => s.startsWith('DEADLINE_NOTICE ' + m.id + ':turn:2')), 'own timeout announcement');
	const late = await request(p0, 'select', {
		from: 60, seq: m.seq
	});
	assert.match(late.error, /Automatic turn is being announced/);
	a.call('teacher/pause', {}, 'fixture');
	await p0.wait('window.snap.phase==="paused"');
	await p1.wait('window.snap.match.turnClock.noticeRemainingMs>0');
	await p0.screenshot(evidence + '/own-automatic-notice.png');
	await p1.screenshot(evidence + '/opponent-automatic-notice.png');
	const teacher = await browser.page(base + '/unity/index.html?qa=1', {
		blockSdk: true, initScript: 'window.calls=[];const f=fetch;window.fetch=async(...a)=>{window.calls.push(String(a[0]));const r=await f(...a);try{const v=await r.clone().json();if(v.roster)window.teacher=v;if(v.match)window.spectator=v;}catch{}return r;};'
	});
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
	await teacher.wait('!!window.teacher?.matches?.length');
	await click(teacher, 800, 231);
	await teacher.wait('!!window.spectator?.match');
	await sleep(500);
	await teacher.screenshot(evidence + '/teacher-timeout-readonly.png');
	assert.equal(await teacher.evaluate("sessionStorage.getItem('studentToken')"), null);
	assert.equal(await teacher.evaluate("Object.keys(sessionStorage).filter(k=>k.startsWith('history.tips.')).length"), 0);
	assert(!(await teacher.evaluate('window.calls')).some(x => /\/(move|select|ack)$/.test(x)));
	const info = await teacher.call('Target.getTargetInfo');
	await browser.send('Target.closeTarget', {
		targetId: info.targetInfo.targetId
	});
	const seq = m.seq;
	const selected = await request(p0, 'select', {
		from: 60, seq
	});
	assert(selected.error, 'deadline rejects last-second selection');
	assert.equal(m.seq, seq);
	await reload(p0);
	await until(() => logs(p0).filter(s => s.startsWith('DEADLINE_NOTICE ' + m.id + ':turn:2')).length >= 2, 'turn notice reconnect');
	assert.equal(m.seq, seq);
	a.call('teacher/resume', {}, 'fixture');
	await until(() => m.seq === seq + 1, 'one automatic move');
	assert(m.events.find(e => e.seq === m.seq)?.automatic);
	await sleep(1200);
	assert.equal(m.seq, seq + 1, 'repeated polling no duplicate');
	assert.equal(m.reveal, null, 'first timeout fixture is quiet');
	// Fresh round, side1 only legal move captures flag; ensures final reveal gates survive timeout.
	a.call('teacher/end', {}, 'fixture');
	for (const s of seats)
		a.call('state', {}, s.token);
	a.call('teacher/start', {}, 'fixture');
	m = [...a.matches.values()][0];
	for (const s of seats) {
		a.call('setup/begin', {
			matchId: m.id
		}, s.token);
		a.call('setup', {
			matchId: m.id, revision: 0
		}, s.token);
	}
	m.board.fill(null);
	for (const [i, side, rank] of [[30, 1, '3'], [20, 1, 'B'], [31, 1, 'B'], [0, 1, 'F'], [40, 0, 'F']])
		m.board[i] = {
			id: 'final-' + i, side, rank
		};
	m.turn = 1;
	m.selection = null;
	m.history = [[], []];
	m.turnClock = null;
	a.tick();
	for (const p of ps)
		await p.wait('window.snap.match.id===' + JSON.stringify(m.id));
	await focus(p1);
	await until(() => m.turnClock.banner === 0, 'second side grace');
	m.turnClock.remaining = 500;
	await until(() => logs(p1).some(s => s.startsWith('DEADLINE_NOTICE ' + m.id + ':turn:2')), 'side1 announcement');
	await p1.screenshot(evidence + '/side1-timeout.png');
	await until(() => m.phase === 'over', 'automatic final flag capture');
	assert.equal(m.winner, 1);
	assert(m.reveal && !m.reveal.ack.every(Boolean));
	await until(() => logs(p1).some(s => s.startsWith('BATTLE_BANTER ' + m.seq + ' ')), 'actual final battle');
	a.call('teacher/pause', {}, 'fixture');
	await sleep(500);
	await p1.screenshot(evidence + '/final-combat.png');
	assert(!logs(p1).some(s => s.startsWith('ENDGAME_SCREEN ' + m.id)), 'no premature result');
	// Both actual Unity click-to-Continue gestures, never a teacher acknowledgment.
	await until(() => logs(p0).some(s => s.startsWith('BATTLE_BANTER ' + m.seq + ' ')), 'other final battle');
	await sleep(2500);
	for (const p of ps) {
		for (let i = 0; i < 8 && m.reveal; i++) {
			await click(p, 600, 671);
			await sleep(400);
			const side = p === p0 ? 0 : 1;
			if (!m.reveal || m.reveal.ack[side])
				break;
		}
	}
	assert.equal(m.reveal, null, 'both clients release final reveal');
	a.call('teacher/resume', {}, 'fixture');
	await until(() => logs(p1).some(s => s.startsWith('ENDGAME_SCREEN ' + m.id)), 'final victory');
	await p1.screenshot(evidence + '/final-result.png');
	a.call('teacher/end', {}, 'fixture');
	for (const s of seats)
		a.call('state', {}, s.token);
	a.call('teacher/start', {}, 'fixture');
	m = [...a.matches.values()][0];
	await p1.wait('window.snap.match.id===' + JSON.stringify(m.id));
	a.call('setup/begin', {
		matchId: m.id
	}, seats[1].token);
	m.setupClocks[1].deadline = Date.now() + 600;
	await until(() => logs(p1).some(s => s.startsWith('DEADLINE_NOTICE ' + m.id + ':setup')), 'side1 setup expiry');
	await p1.screenshot(evidence + '/side1-setup-expiry.png');
	await until(() => m.setupClocks[1].noticeRemaining === 0, 'side1 three-second notice ends');
	await p1.wait('window.snap.match.setup.noticeRemainingMs===0');
	assert.equal(m.phase, 'setup');
	assert.equal(m.ready[0], false);
	assert(!logs(p1).some(s => s.startsWith('YOUR_TURN_NOTICE ' + m.id)), 'no false play while opponent arranging');
	await p1.screenshot(evidence + '/waiting-after-expiry.png');
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', checks: ['both actual Unity seats', 'own setup expiry notice; early lock excluded', 'setup pause/reload barrier', 'server15second reminder', 'own/opponent timeout announcements', 'manual selection rejected at deadline', 'turn notice pause/reload', 'one automatic move no repeated-poll duplication', 'side1 automatic final flag capture', 'both actual Continue buttons before final result'], scope: 'isolated fixture,SDK blocked, no live class changes'
	}, null, 2));
	console.log('PASS ' + evidence);
}
catch (e) {
	for (let i = 0; i < ps.length; i++)
		await ps[i].screenshot(evidence + '/failure-' + i + '.png');
	console.error(evidence);
	throw e;
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
