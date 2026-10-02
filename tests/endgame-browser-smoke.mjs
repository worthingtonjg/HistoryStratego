import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { launchBrowser } from './browser-helper.mjs';
const deskOnly = process.argv.includes('--desk-only');
const evidence = 'docs/evidence/' + (deskOnly ? 'endgame-desk-run-' : 'endgame-run-') + Date.now();
const authority = createAuthority({
	timedSetup: false,
	teacherKey: 'endgame-test-key', classCode: 'END'
});
const server = serve(authority, 0, 'Builds/EndgameStage');
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
let browser, teacher, p1, p2;
const initScript = "const originalFetch=window.fetch;window.fetch=async function(input,options){const response=await originalFetch.call(this,input,options);try{const data=await response.clone().json();if(data.player)window.__student=data;if(data.perspectiveName)window.__spectator=data;}catch{}return response;};";
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
const messages = p => p.logs.filter(e => e.method === 'Runtime.consoleAPICalled').flatMap(e => e.params.args.map(a => String(a.value || '')));
const results = (p, id) => messages(p).filter(s => s.startsWith('ENDGAME_SCREEN ' + id + ' |'));
async function actionUntil(p, x, y, condition, label) {
	const until = Date.now() + 30000;
	while (!condition() && Date.now() < until) {
		await click(p, x, y);
		await new Promise(r => setTimeout(r, 900));
	}
	assert(condition(), label);
}
async function reload(p) {
	p.logs.length = 0;
	await p.call('Page.reload');
	await p.wait('!!window.unityInstance', 120000);
	await p.wait('!!window.__student?.match', 30000);
	await new Promise(r => setTimeout(r, 1500));
}
async function dismiss(p, m) {
	await click(p, 600, 561);
	await p.wait("sessionStorage.getItem('history.dismissed.'+window.__student.player)===" + JSON.stringify(m.id), 15000);
	await new Promise(r => setTimeout(r, 800));
}
try {
	await mkdir(evidence, {
		recursive: true
	});
	browser = await launchBrowser();
	teacher = await browser.page(base + '/unity/index.html?qa=1', {
		initScript, blockSdk: true
	});
	await teacher.wait('!!window.unityInstance', 120000);
	await type(teacher, 400, 273, 'endgame-test-key');
	await click(teacher, 400, 316);
	await new Promise(r => setTimeout(r, 1600));
	p1 = await browser.page(base + '/unity/index.html?qa=1', {
		initScript, blockSdk: true
	});
	p2 = await browser.page(base + '/unity/index.html?qa=1', {
		initScript, blockSdk: true
	});
	for (const [p, name] of [[p1, 'Alex'], [p2, 'Sam']]) {
		await p.wait('!!window.unityInstance', 120000);
		await type(p, 350, 123, 'END');
		await type(p, 350, 163, name);
		await click(p, 350, 206);
		await p.wait('!!window.__student?.player', 30000);
	}
	await actionUntil(teacher, 240, 161, () => authority.matches.size === 1, 'start first round');
	for (const scenario of (deskOnly ? ['teacher-ended'] : ['flag', 'tie-no-moves', 'no-moves', 'teacher-ended'])) {
		const m = [...authority.matches.values()][0];
		for (const [p, side] of [[p1, 0], [p2, 1]])
			await actionUntil(p, 1060, 196, () => m.ready[side], 'lock ' + side);
		m.board.fill(null);
		m.board[60] = {
			side: 0, rank: scenario === 'tie-no-moves' ? '4' : '2', id: 'fixture-red'
		};
		m.board[99] = {
			side: 0, rank: '2', id: 'red-spare'
		};
		m.board[0] = {
			side: 1, rank: 'F', id: 'blue-flag'
		};
		m.history = [[], []];
		m.events = [];
		m.selection = null;
		if (scenario === 'flag')
			m.board[50] = {
				side: 1, rank: 'F', id: 'target-flag'
			};
		if (scenario === 'tie-no-moves')
			m.board[50] = {
				side: 1, rank: '4', id: 'target-tie'
			};
		await new Promise(r => setTimeout(r, 2200));
		await click(teacher, 800, 231);
		await teacher.wait('window.__spectator?.match?.id===' + JSON.stringify(m.id), 15000);
		if (scenario === 'teacher-ended') {
			await actionUntil(teacher, 1100, 371, () => authority.call('teacher/state', {}, 'endgame-test-key').phase === 'ended', 'teacher end');
			assert.equal(m.winner, -1);
		}
		else {
			await square(p1, 60);
			await waitFor(() => m.selection?.from === 60, 'final selection');
			await square(p1, 50, 0, scenario !== 'no-moves');
			await waitFor(() => m.phase === 'over', 'terminal move');
			assert.equal(m.winner, 0);
			if (m.reveal) {
				for (const p of [p1, p2, teacher])
					await waitFor(() => messages(p).some(s => s.startsWith('BATTLE_BANTER ' + m.seq + ' ')), 'final reveal rendered');
				for (const p of [p1, p2, teacher])
					assert.equal(results(p, m.id).length, 0, 'no premature result');
				await p1.screenshot(evidence + '/' + scenario + '-final-reveal.png');
				const beforeDismiss = await p1.evaluate("sessionStorage.getItem('history.dismissed.'+window.__student.player)");
				await click(p1, 600, 561);
				assert.equal(await p1.evaluate("sessionStorage.getItem('history.dismissed.'+window.__student.player)"), beforeDismiss, 'cannot dismiss final reveal');
				await ack(p1, m, 0, 'winner final ack');
				for (const p of [p1, p2, teacher])
					assert.equal(results(p, m.id).length, 0, 'one ack does not end reveal');
				await reload(p2);
				assert(m.reveal);
				assert.equal(results(p2, m.id).length, 0, 'reloaded loser reviews final combat');
				await ack(p2, m, 1, 'loser final ack');
				assert(!m.reveal);
			}
		}
		for (const p of [p1, p2, teacher])
			await waitFor(() => results(p, m.id).length > 0, 'result screen');
		if (scenario === 'teacher-ended') {
			for (const p of [p1, p2, teacher])
				assert.match(results(p, m.id).at(-1), /Round ended.*No winner was declared/);
		}
		else {
			assert.match(results(p1, m.id).at(-1), /You won!.*Winner: RED - Alex/);
			assert.match(results(p2, m.id).at(-1), /You lost.*Winner: RED - Alex/);
			assert.match(results(teacher, m.id).at(-1), /Match complete.*Winner: RED - Alex/);
			for (const p of [p1, p2, teacher])
				assert(results(p, m.id).at(-1).includes(scenario === 'flag' ? 'Flag captured.' : 'No legal moves remain.'));
		}
		await p1.screenshot(evidence + '/' + scenario + '-winner.png');
		await p2.screenshot(evidence + '/' + scenario + '-loser.png');
		await teacher.screenshot(evidence + '/' + scenario + '-teacher.png');
		await dismiss(p1, m);
		await p1.screenshot(evidence + '/' + scenario + '-red-lobby.png');
		assert.equal(await p2.evaluate("sessionStorage.getItem('history.dismissed.'+window.__student.player)===" + JSON.stringify(m.id)), false, 'other participant remains at result');
		await reload(p1);
		assert.equal(results(p1, m.id).length, 0, 'dismissal survives reload');
		await p1.screenshot(evidence + '/' + scenario + '-lobby-reloaded.png');
		assert.equal(authority.matches.get(m.id), m, 'dismissal retains teacher match history');
		await dismiss(p2, m);
		await click(teacher, 600, 561);
		await new Promise(r => setTimeout(r, 1400));
		if (scenario !== 'teacher-ended')
			await actionUntil(teacher, 690, 161, () => authority.call('teacher/state', {}, 'endgame-test-key').phase === 'ended', 'end completed round');
		await actionUntil(teacher, 240, 161, () => [...authority.matches.values()][0].id !== m.id, 'next assignment');
		const next = [...authority.matches.values()][0];
		for (const p of [p1, p2])
			await p.wait('window.__student?.match?.id===' + JSON.stringify(next.id), 15000);
		await new Promise(r => setTimeout(r, 1600));
		await p1.screenshot(evidence + '/' + scenario + '-next-setup.png');
		console.log('PASS Unity endgame ' + scenario + ': reveal order, named results, independent lobby/reload and next assignment');
	}
	const prior = [...authority.matches.values()][0], oldStates = [await p1.evaluate('window.__student'), await p2.evaluate('window.__student')];
	await actionUntil(teacher, 690, 161, () => authority.call('teacher/state', {}, 'endgame-test-key').phase === 'ended', 'end before re-pair');
	async function api(route, body, token = '') {
		const response = await fetch(base + '/api/' + route, {
			method: 'POST', headers: {
				'Content-Type': 'application/json', Authorization: 'Bearer ' + token
			}, body: JSON.stringify(body)
		});
		assert(response.ok, route);
		return response.json();
	}
	const c = await api('join', {
		classCode: 'END', name: 'Charlie'
	}), d = await api('join', {
		classCode: 'END', name: 'Dana'
	});
	await api('teacher/swap', {
		a: oldStates[1].player, b: c.player
	}, 'endgame-test-key');
	await actionUntil(teacher, 240, 161, () => [...authority.matches.values()][0].id !== prior.id, 'start repaired round');
	for (const [p, opponent] of [[p1, 'Charlie'], [p2, 'Dana']]) {
		await p.wait('window.__student?.match?.phase==="setup"&&window.__student.match.playerNames.includes(' + JSON.stringify(opponent) + ')', 15000);
		await new Promise(r => setTimeout(r, 1800));
		const snapshot = await p.evaluate('window.__student'), assigned = authority.matches.get(snapshot.match.id);
		await actionUntil(p, 1060, 196, () => assigned.ready[snapshot.match.side], 'lock genuinely repaired setup');
		assert.equal(assigned.board.filter(piece => piece?.side === snapshot.match.side).length, 40);
		await p.screenshot(evidence + '/repaired-' + opponent + '.png');
	}
	assert.equal(prior.archived, true);
	assert.equal(prior.winner, -1);
	assert.equal(authority.students.size, 4);
	console.log('PASS Unity real teacher End/swap/Start: Alex now paired with Charlie, Sam with Dana, old round archived.');
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', utc: new Date().toISOString(), build: 'Builds/EndgameStage', mode: deskOnly ? 'targeted final-build teacher desk and re-pairing' : 'full endgame regression', checks: deskOnly ? ['actual Unity two players and teacher', 'teacher-ended round no fabricated winner', 'independent dismissal and reload', 'Back to matches remains on teacher desk', 'real End/swap/Start with changed opponents'] : ['actual Unity two players and teacher', 'flag final combat and both acknowledgments before result', 'equal-rank combat causes no-legal-moves defeat', 'noncombat no-legal-moves defeat', 'teacher-ended round without invented winner', 'winner loser neutral teacher names colors reasons', 'each player independently returns to lobby', 'dismissal persists across reload with same seat', 'teacher match retained after dismissal', 'both players eligible for next teacher round', 'actual teacher End/swap/Start changes opponents to new fixture students and archives old round'], sdk: 'deliberately blocked; client-only UI test'
	}, null, 2));
}
catch (error) {
	for (const [p, name] of [[teacher, 'teacher'], [p1, 'red'], [p2, 'blue']])
		if (p)
			await p.screenshot(evidence + '/failure-' + name + '.png');
	throw error;
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
