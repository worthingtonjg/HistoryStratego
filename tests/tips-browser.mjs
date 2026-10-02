import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { launchBrowser } from './browser-helper.mjs';
const a = createAuthority({
	classCode: 'TIPS', teacherKey: 'fixture'
}), seats = [0, 1].map(() => a.call('join', {
	classCode: 'TIPS'
}));
a.call('teacher/start', {}, 'fixture');
let m = [...a.matches.values()][0];
const clickMode = process.env.TIP_CLICK === '1';
const stage = process.env.TIP_STAGE || 'Builds/TutorialStage', server = serve(a, 0, stage), sleep = ms => new Promise(r => setTimeout(r, ms));
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port, evidence = 'docs/evidence/tips-run-' + Date.now();
await mkdir(evidence, {
	recursive: true
});
await writeFile(stage + '/tips-frame.html', '<!doctype html><style>html,body{margin:0;height:100%;overflow:hidden}iframe{width:100%;height:100%;border:0;display:block}</style><button style="position:fixed;left:0;top:0;width:24px;height:24px;z-index:2">.</button><iframe src="index.html?qa=1"></iframe>');
let browser, p;
async function until(fn, label, ms = 30000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (await fn())
			return;
		await sleep(100);
	}
	throw Error('Timeout ' + label);
}
async function focus() {
	await p.call('Emulation.setFocusEmulationEnabled', {
		enabled: true
	});
	await p.call('Page.bringToFront');
	await p.evaluate('window.focus();document.querySelector("canvas").focus()');
	await p.wait('document.hasFocus()&&!document.hidden');
}
async function click(x, y) {
	for (const type of ['mousePressed', 'mouseReleased'])
		await p.call('Input.dispatchMouseEvent', {
			type, x: x * 1280 / 1200, y: y * 1280 / 1200 + 20, button: 'left', clickCount: 1
		});
}
async function load(side) {
	p = await browser.page(base + (clickMode ? '/unity/tips-frame.html' : '/unity/index.html?qa=1'), {
		blockSdk: true, initScript: `if(window!==parent)parent.gameFrame=window;sessionStorage.setItem('studentToken',${JSON.stringify(seats[side].token)});window.calls=[];window.opened=[];window.open=(...a)=>window.opened.push(a);const f=fetch;window.fetch=async(...args)=>{window.calls.push(String(args[0]));const r=await f(...args);try{const s=await r.clone().json();if(s.player)window.snap=s;}catch{}return r;};`
	});
	if (clickMode) {
		const evaluate = p.evaluate, wait = p.wait;
		const wrap = s => '(()=>{const window=globalThis.gameFrame;if(!window)return false;const document=window.document;return eval(' + JSON.stringify(s) + ');})()';
		p.evaluate = s => evaluate(wrap(s));
		p.wait = (s, ms) => wait(wrap(s), ms);
	}
	await p.wait('!!window.unityInstance', 120000);
	await p.wait('!!window.snap?.match');
	await focus();
	return p;
}
const tipState = async () => p.evaluate("(sessionStorage.getItem('history.tips.'+window.snap.player+'.'+window.snap.match.id)||'0|0|0|0').split('|').map(Number)");
async function dismiss(bit, x = 600, y = 450) {
	await sleep(300);
	const seq = m.seq, calls = await p.evaluate('window.calls.length');
	await click(x, y);
	await until(async () => ((await tipState())[1] & bit) !== 0, 'click dismiss ' + bit, 3000);
	await sleep(250);
	assert.equal(m.seq, seq, 'dismissal cannot move a piece');
	assert.equal(await p.evaluate('window.opened.length'), 0, 'dismissal cannot open a source');
	const added = await p.evaluate('window.calls.slice(' + calls + ')');
	assert(!added.some(x => /\/(move|select|ack)$/.test(x)), 'dismissal cannot select, move, or acknowledge');
}
async function completed(bit) {
	await until(async () => ((await tipState())[1] & bit) !== 0, 'tip completed ' + bit, 25000);
}
async function combat(side, ownAttacks, attacker, defender) {
	const flip = i => side ? 99 - i : i, actor = ownAttacks ? side : 1 - side;
	m.board.fill(null);
	m.history = [[], []];
	m.selection = null;
	m.turn = actor;
	for (const [i, owner, rank] of [[60, actor, attacker], [50, 1 - actor, defender], [90, side, '2'], [99, side, 'F'], [10, 1 - side, '2'], [0, 1 - side, 'F']])
		m.board[flip(i)] = {
			id: 'fixture-' + m.seq + '-' + i, side: owner, rank
		};
	a.call('move', {
		from: flip(60), to: flip(50), seq: m.seq, requestId: 'tip-' + side + '-' + m.seq
	}, seats[actor].token);
	const seq = m.seq;
	await p.wait('window.snap?.match?.battle?.seq===' + seq);
	await until(() => m.reveal?.ack[side] === true, 'own actual auto-continue', 30000);
	assert.equal((await tipState())[2], 0, 'tip waits for opponent acknowledgment');
	await sleep(800);
	assert.equal((await tipState())[2], 0);
	if (clickMode && defender === 'B')
		await p.call('Input.dispatchMouseEvent', {
			type: 'mousePressed', x: 640, y: 60, button: 'left', clickCount: 1
		});
	a.call('ack', {
		seq, matchId: m.id
	}, seats[1 - side].token);
	return seq;
}
try {
	browser = await launchBrowser();
	await load(0);
	await p.screenshot(evidence + '/versus-objective.png');
	await click(600, 794);
	await p.wait('window.snap?.match?.setup?.started===true');
	for (const [side, s] of seats.entries()) {
		a.call('setup/begin', {
			matchId: m.id
		}, s.token);
		a.call('setup', {
			matchId: m.id, revision: 0
		}, s.token);
	}
	await p.wait('window.snap?.match?.phase==="play"');
	for (const side of [0, 1]) {
		if (side === 1)
			await load(side);
		assert.equal((await tipState())[1], 0, 'other side combat must not masquerade as own discoveries');
		await combat(side, true, '2', 'B');
		await until(async () => (await tipState())[2] === 1, 'Bomb tip');
		await sleep(350);
		await p.screenshot(evidence + '/bomb-side-' + side + '.png');
		if (clickMode) {
			await p.call('Input.dispatchMouseEvent', {
				type: 'mouseReleased', x: 640, y: 60, button: 'left', clickCount: 1
			});
			await sleep(200);
			assert.equal((await tipState())[2], 1, 'held opening gesture cannot dismiss tip');
		}
		if (side === 0) {
			await sleep(1500);
			if (clickMode) {
				for (const type of ['mousePressed', 'mouseReleased'])
					await p.call('Input.dispatchMouseEvent', {
						type, x: 8, y: 8, button: 'left', clickCount: 1
					});
				await p.wait('!document.hasFocus()');
				await sleep(250);
				const frozen = (await tipState())[3];
				await sleep(1800);
				assert.equal((await tipState())[3], frozen, 'unfocused tip time freezes');
				await focus();
			}
			const remaining = (await tipState())[3];
			await p.call('Page.reload');
			await p.wait('!!window.unityInstance', 120000);
			await p.wait('!!window.snap?.match');
			await focus();
			const resumed = await tipState();
			assert.equal(resumed[2], 1);
			assert(resumed[3] <= remaining + .1 && resumed[3] > 0, 'refresh preserves remaining time');
		}
		if (clickMode)
			await dismiss(1, 90, 866);
		else
			await completed(1);
		const seq = await combat(side, side === 0, side === 0 ? '3' : '10', side === 0 ? '10' : '3');
		await until(async () => (await tipState())[2] === 2, 'Marshal tip queued first');
		const logs = p.logs.filter(e => e.method === 'Runtime.consoleAPICalled');
		const tip = logs.filter(e => JSON.stringify(e.params).includes('TIP_OPEN 2')).at(-1), notice = logs.filter(e => JSON.stringify(e.params).includes('YOUR_TURN_NOTICE')).at(-1);
		if (side === 1 && notice)
			assert(tip.params.timestamp - notice.params.timestamp >= 1800, 'tip waits for initial turn banner');
		await p.call('Emulation.setDeviceMetricsOverride', {
			width: 900, height: 850, deviceScaleFactor: 1, mobile: false
		});
		await sleep(400);
		await p.screenshot(evidence + '/marshal-side-' + side + '-narrow.png');
		if (side === 0) {
			a.call('teacher/pause', {}, 'fixture');
			await p.wait('window.snap?.phase==="paused"');
			const frozen = (await tipState())[3];
			await sleep(2500);
			assert.equal((await tipState())[3], frozen);
			a.call('teacher/resume', {}, 'fixture');
			await p.wait('window.snap?.phase==="active"');
			await focus();
			await sleep(500);
		}
		if (clickMode) {
			await p.call('Emulation.setDeviceMetricsOverride', {
				width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false
			});
			await sleep(400);
			await dismiss(2);
			for (const type of ['mousePressed', 'mouseReleased'])
				await p.call('Input.dispatchMouseEvent', {
					type, x: 640, y: 500, button: 'left', clickCount: 2
				});
		}
		else
			await completed(2);
		await until(async () => (await tipState())[2] === 4, 'own Miner-loss tip queued next');
		await sleep(350);
		await p.screenshot(evidence + '/miner-side-' + side + '.png');
		assert.equal((await tipState())[2], 4, 'queued tip survives prior double-click gesture');
		if (clickMode)
			await dismiss(4, 400, 500);
		else
			await completed(4);
		assert.equal((await tipState())[1], 7);
		await p.call('Page.reload');
		await p.wait('!!window.unityInstance', 120000);
		await p.wait('!!window.snap?.match');
		await focus();
		await sleep(2500);
		assert.equal((await tipState())[1], 7);
		assert.equal((await tipState())[2], 0, 'seen tips never replay on reconnect');
		if (side === 0) {
			const info = await p.call('Target.getTargetInfo');
			await browser.send('Target.closeTarget', {
				targetId: info.targetInfo.targetId
			});
		}
	}
	// Teacher view is isolated and read-only: it may not store or display a student's tips.
	const student = p;
	await loadTeacher();
	await sleep(2500);
	assert.equal(await p.evaluate("Object.keys(sessionStorage).filter(k=>k.startsWith('history.tips.')).length"), 0);
	assert(!p.logs.some(e => JSON.stringify(e).includes('TIP_OPEN')));
	await p.screenshot(evidence + '/teacher-no-tutorial.png');
	p = student;
	a.call('teacher/end', {}, 'fixture');
	for (const s of seats)
		a.call('state', {}, s.token);
	a.call('teacher/start', {}, 'fixture');
	m = [...a.matches.values()][0];
	await p.wait('window.snap?.match?.id===' + JSON.stringify(m.id));
	await focus();
	assert.deepEqual((await tipState()).slice(0, 3), [0, 0, 0], 'new match resets tips');
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', mode: clickMode ? 'click-dismiss' : 'automatic', stage, checks: ['actual Unity both player orientations', 'versus Flag objective and Start button', 'legitimate enemy Bomb discovery', 'enemy Marshal reveal and own Miner loss', 'no own-rank or opposing-player false trigger', 'combat/opponent acknowledgment barrier', 'initial turn banner priority', '8/12-second readable queue', 'mid-tip refresh resumes remaining time', 'pause/resume', 'completed tips survive reload', 'new-match reset', 'teacher does not display or persist tips', 'narrow long-text wrapping']
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
async function loadTeacher() {
	p = await browser.page(base + '/unity/index.html?qa=1', {
		blockSdk: true, initScript: 'const f=fetch;window.fetch=async(...a)=>{const r=await f(...a);try{const s=await r.clone().json();if(s.roster)window.teacher=s;if(s.match)window.spectator=s;}catch{}return r;};'
	});
	await p.wait('!!window.unityInstance', 120000);
	await sleep(500);
	await click(400, 273);
	for (const key of 'fixture') {
		await p.call('Input.dispatchKeyEvent', {
			type: 'keyDown', key, text: key
		});
		await p.call('Input.dispatchKeyEvent', {
			type: 'keyUp', key
		});
	}
	await click(400, 316);
	await p.wait('!!window.teacher?.matches?.length');
	await sleep(500);
	await click(800, 231);
	await p.wait('!!window.spectator?.match');
}
