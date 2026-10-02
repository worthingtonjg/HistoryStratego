import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { generateFormation } from '../web/formation.mjs';
import { launchBrowser } from './browser-helper.mjs';
const stage = process.env.CONTINUE_STAGE || 'Builds/ContinueFixStage', finalOnly = process.argv.includes('--final-only');
const a = createAuthority({
	classCode: 'CLOCK', teacherKey: 'fixture', timedSetup: false
});
const seats = [0, 1].map(() => a.call('join', {
	classCode: 'CLOCK'
}));
a.call('teacher/start', {}, 'fixture');
seats.forEach(s => a.call('setup', {
	ranks: generateFormation()
}, s.token));
const m = [...a.matches.values()][0], server = serve(a, 0, stage), sleep = ms => new Promise(r => setTimeout(r, ms));
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port, evidence = 'docs/evidence/continue-run-' + Date.now();
await mkdir(evidence, {
	recursive: true
});
await writeFile(stage + '/continue-frame.html', '<!doctype html><style>html,body{margin:0;height:100%;background:#000}iframe{width:100%;height:100%;border:0}</style><button style="position:fixed;left:0;top:0;width:24px;height:24px;z-index:2" title="Test focus outside game">.</button><iframe src="index.html?qa=1"></iframe>');
let browser, p, failAck = false;
const attempts = [];
const call = a.call.bind(a);
a.call = (route, b, token) => {
	if (route === 'ack' && token === seats[0].token) {
		attempts.push({
			seq: b.seq, automatic: b.automatic
		});
		if (failAck) {
			failAck = false;
			throw Error('Injected transient acknowledgment failure');
		}
	}
	return call(route, b, token);
};
async function until(fn, label, ms = 30000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (await fn())
			return;
		await sleep(100);
	}
	throw Error('Timeout ' + label);
}
try {
	browser = await launchBrowser();
	p = await browser.page(base + '/unity/continue-frame.html', {
		blockSdk: true, initScript: `sessionStorage.setItem('studentToken',${JSON.stringify(seats[0].token)});if(window!==parent)parent.gameFrame=window;const orig=fetch;window.fetch=async(...args)=>{const r=await orig(...args);try{const d=await r.clone().json();if(d.player)window.snap=d;}catch{}return r;};`
	});
	await p.wait('!!window.gameFrame?.unityInstance', 120000);
	await p.call('Emulation.setFocusEmulationEnabled', {
		enabled: true
	});
	await p.call('Page.bringToFront');
	await p.evaluate('window.gameFrame.focus();window.gameFrame.document.querySelector("canvas").focus()');
	await p.wait('window.gameFrame.document.hasFocus() && !window.gameFrame.document.hidden');
	const results = [];
	for (let round = finalOnly ? 4 : 0; round < 5; round++) {
		m.board.fill(null);
		m.history = [[], []];
		m.selection = null;
		m.turn = 0;
		const attacker = round % 2 ? '7' : '6', defender = round === 4 ? 'F' : round % 2 ? '6' : '7';
		for (const [i, side, rank] of [[60, 0, attacker], [50, 1, defender], [99, 0, 'F'], [90, 0, '2'], [0, 1, 'F'], [10, 1, '2']])
			m.board[i] = {
				id: round + '-' + i, side, rank
			};
		a.call('move', {
			from: 60, to: 50, seq: m.seq, requestId: 'battle-' + round
		}, seats[0].token);
		const seq = m.seq;
		await until(() => p.logs.some(e => e.method === 'Runtime.consoleAPICalled' && JSON.stringify(e.params).includes('BATTLE_BANTER ' + seq + (round === 4 ? ' ' : ' Six Seven!!!!'))), 'exact flavor rendered');
		await sleep(3000);
		if (round === 0)
			await p.screenshot(evidence + '/exact-six-seven.png');
		if (round === 1) {
			for (const type of ['mousePressed', 'mouseReleased'])
				await p.call('Input.dispatchMouseEvent', {
					type, x: 8, y: 8, button: 'left', clickCount: 1
				});
			await p.wait('!window.gameFrame.document.hasFocus()');
			await sleep(6500);
			assert.equal(m.reveal.ack[0], false, 'blur never consumes the reading interval');
			await p.screenshot(evidence + '/focus-paused.png');
			await p.call('Emulation.setFocusEmulationEnabled', {
				enabled: true
			});
			await p.call('Page.bringToFront');
			await p.evaluate('window.gameFrame.focus();window.gameFrame.document.querySelector("canvas").focus()');
			await p.call('Page.bringToFront');
		}
		if (round === 2) {
			a.call('teacher/pause', {}, 'fixture');
			await p.wait('window.gameFrame.snap?.phase==="paused"');
			await sleep(6000);
			assert.equal(m.reveal.ack[0], false, 'teacher pause freezes own timer');
			a.call('teacher/resume', {}, 'fixture');
			failAck = true;
		}
		if (round === 3) {
			await p.evaluate('window.gameFrame.slowTimer=setInterval(()=>{const end=performance.now()+1250;while(performance.now()<end){}},1450)');
		}
		await until(() => m.reveal?.ack[0] === true, 'own automatic continue round ' + round, 40000);
		if (round === 3)
			await p.evaluate('clearInterval(window.gameFrame.slowTimer)');
		assert.equal(m.reveal.ack[1], false, 'own timer cannot acknowledge opponent');
		assert(attempts.filter(x => x.seq === seq).every(x => x.automatic === true), 'no focus gesture may manually dismiss combat');
		await p.wait('window.gameFrame.snap?.match?.battle?.ack[0]===true');
		await sleep(400);
		await p.screenshot(evidence + '/waiting-opponent-' + round + '.png');
		results.push({
			round, seq, attacker, defender, automaticAttempts: attempts.filter(x => x.seq === seq).length
		});
		if (round === 4)
			assert(!p.logs.some(e => JSON.stringify(e).includes('ENDGAME_SCREEN')), 'final result waits for both acknowledgments');
		a.call('ack', {
			seq, matchId: m.id
		}, seats[1].token);
		await p.wait('!window.gameFrame.snap?.match?.battle');
		await sleep(1000);
		if (round === 4) {
			await until(() => p.logs.some(e => JSON.stringify(e).includes('ENDGAME_SCREEN')), 'final result after barrier');
			await p.screenshot(evidence + '/final-result.png');
		}
	}
	assert(attempts.every(x => x.automatic === true));
	if (!finalOnly)
		assert.equal(results[2].automaticAttempts, 2, 'one failure then successful own retry');
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', results, checks: ['actual Unity in iframe', finalOnly ? 'final-result barrier' : 'five consecutive battles including final-result barrier', 'exact 6/7 both orientations', 'ordinary polling', 'focus pause and restore', 'teacher pause/resume', 'failed ack retry', 'slow foreground frames', 'own ack and opponent barrier distinct']
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
