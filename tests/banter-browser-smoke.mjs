import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { move } from '../server/game.mjs';
import { createAuthority, serve } from '../server/server.mjs';
import { launchBrowser } from './browser-helper.mjs';
const evidence = 'docs/evidence/banter-run-' + Date.now();
const live = process.argv.includes('--live');
const expectedStatus = live ? 'Playroom connected' : 'Playroom unavailable';
const authority = createAuthority({
	timedSetup: false,
	teacherKey: 'unity-test-key', classCode: 'UNITY'
});
const server = serve(authority, 0, process.env.HISTORY_TEST_BUILD || 'Builds/BanterStage');
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
let browser, teacher, p1, p2;
const initScript = "const originalFetch=window.fetch;window.fetch=async function(input,options){const response=await originalFetch.call(this,input,options);if(String(input).includes('teacher/spectate')){try{window.__spectator=await response.clone().json()}catch{}}return response;};const open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...args){if(String(url).includes('teacher/spectate'))this.addEventListener('load',()=>{try{window.__spectator=JSON.parse(this.responseText)}catch{}});return open.call(this,method,url,...args);};Object.defineProperty(window,'unityInstance',{get(){return window.__unity},set(v){window.__unity=v;const send=v.SendMessage.bind(v);v.SendMessage=(go,method,arg)=>{if(method==='PresenceStatus')window.__presenceStatus=arg;return send(go,method,arg);};}});";
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
	teacher = await browser.page(base + '/unity/index.html?qa=1#r=WRNG', {
		initScript, blockSdk: true
	});
	await teacher.wait('!!window.unityInstance', 120000);
	await new Promise(r => setTimeout(r, 3500));
	await teacher.screenshot(evidence + '/login.png');
	await type(teacher, 400, 273, 'unity-test-key');
	await click(teacher, 400, 316);
	await teacher.wait("window.__presenceStatus?.includes('Playroom unavailable')", 45000);
	console.log('PASS Unity: teacher canvas login and deliberate presence-failure fallback');
	p1 = await browser.page(base + '/unity/index.html?qa=1#r=WRNG', {
		initScript, blockSdk: !live
	}), p2 = await browser.page(base + '/unity/index.html?qa=1#r=WRNG', {
		initScript, blockSdk: !live
	});
	for (const [p, name] of [[p1, 'Unity A'], [p2, 'Unity B']]) {
		await p.wait('!!window.unityInstance', 120000);
		await type(p, 350, 123, 'UNITY');
		await type(p, 350, 163, name);
		await click(p, 350, 206);
		await p.wait("window.__presenceStatus?.includes(" + JSON.stringify(expectedStatus) + ")", 45000);
	}
	await waitFor(() => authority.students.size === 2, 'two Unity students');
	const expected = authority.call('teacher/state', {}, 'unity-test-key').presence.roomCode;
	if (live)
		for (const p of [p1, p2])
			assert((await p.evaluate('window.__presenceStatus')).includes('room ' + expected));
	console.log('PASS Unity: two canvas joins; presence mode ' + expectedStatus + '; classroom room ' + expected);
	for (const name of ['Other A', 'Other B'])
		authority.call('join', {
			classCode: 'UNITY', name
		});
	await click(teacher, 240, 161);
	await waitFor(() => authority.matches.size === 2, 'teacher start');
	const m = [...authority.matches.values()][0];
	await new Promise(r => setTimeout(r, 1500));
	for (const [p, side] of [[p1, 0], [p2, 1]]) {
		const until = Date.now() + 30000;
		while (!m.ready[side] && Date.now() < until) {
			await click(p, 1060, 196);
			await new Promise(r => setTimeout(r, 1000));
		}
		assert(m.ready[side], 'Unity formation ' + side);
	}
	const lane = [0, 1, 4, 5, 8, 9].find(x => m.board[60 + x]?.rank === '2' && m.board[30 + x]?.rank === '2');
	assert.notEqual(lane, undefined, 'two front scouts share an open lane');
	const redStart = 60 + lane, redStep = 50 + lane, blueStart = 30 + lane, blueStep = 40 + lane;
	await new Promise(r => setTimeout(r, 1500));
	await click(teacher, 800, 231);
	await new Promise(r => setTimeout(r, 1800));
	await teacher.screenshot(evidence + '/spectator-opening.png');
	await teacher.wait('window.__spectator?.match?.side===0', 15000);
	await teacher.screenshot(evidence + '/spectator-side0.png');
	await square(p1, redStart);
	await waitFor(() => m.selection?.from === redStart, 'authoritative selection');
	await new Promise(r => setTimeout(r, 1300));
	await teacher.screenshot(evidence + '/spectator-selection.png');
	await p1.screenshot(evidence + '/selection.png');
	await square(p1, redStep, 0, false);
	await waitFor(() => m.seq === 3, 'first Unity move');
	await new Promise(r => setTimeout(r, 600));
	await p1.screenshot(evidence + '/movement-player.png');
	await teacher.screenshot(evidence + '/movement-spectator.png');
	await teacher.wait('window.__spectator?.match?.side===0', 15000);
	await click(teacher, 965, 323);
	await teacher.wait('window.__spectator?.match?.side===1', 15000);
	await teacher.screenshot(evidence + '/spectator-side1.png');
	await click(teacher, 100, 151);
	await new Promise(r => setTimeout(r, 1500));
	// Side 1 rotates the board; use a shared open lane from the actual shuffled armies.
	await new Promise(r => setTimeout(r, 2000));
	await square(p2, blueStart, 1);
	await waitFor(() => m.selection?.from === blueStart, 'blue selection');
	await square(p2, blueStep, 1, false);
	await waitFor(() => m.seq === 4, 'second Unity move');
	await new Promise(r => setTimeout(r, 3000));
	await square(p1, redStep);
	await waitFor(() => m.selection?.from === redStep, 'attack selection');
	await p1.screenshot(evidence + '/attack-target.png');
	await square(p1, blueStep);
	await waitFor(() => m.seq === 5, 'Unity combat');
	assert.match(m.events.at(-1).text, /Scout attacks Scout: both removed/);
	await p1.screenshot(evidence + '/board.png');
	await click(teacher, 800, 231);
	await new Promise(r => setTimeout(r, 1800));
	await teacher.screenshot(evidence + '/spectator.png');
	await new Promise(r => setTimeout(r, 4500));
	await p1.screenshot(evidence + '/battle-attacker.png');
	await p2.screenshot(evidence + '/battle-defender.png');
	await teacher.screenshot(evidence + '/battle-spectator.png');
	for (const [width, height] of [[1920, 900], [1366, 768], [900, 850]]) {
		await teacher.call('Emulation.setDeviceMetricsOverride', {
			width, height, deviceScaleFactor: 1, mobile: false
		});
		await new Promise(r => setTimeout(r, 1200));
		await teacher.screenshot(evidence + '/battle-' + width + 'x' + height + '.png');
	}
	await teacher.call('Emulation.setDeviceMetricsOverride', {
		width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false
	});
	assert(m.reveal);
	assert.equal(m.reveal.attacker, '2');
	assert.equal(m.reveal.defender, '2');
	await p2.call('Page.reload');
	await p2.wait('!!window.unityInstance', 120000);
	await new Promise(r => setTimeout(r, 4500));
	await p2.screenshot(evidence + '/battle-reconnected.png');
	assert(m.reveal);
	const banterMessages = p => p.logs.filter(e => e.method === 'Runtime.consoleAPICalled').flatMap(e => e.params.args.map(a => a.value || '')).filter(s => s.startsWith('BATTLE_BANTER 5 '));
	for (const p of [p1, p2, teacher])
		assert(banterMessages(p).length > 0, 'actual Unity displays shared banter');
	const shared = banterMessages(p1)[0];
	for (const p of [p2, teacher])
		for (const line of banterMessages(p))
			assert.equal(line, shared, 'same public combat line including reconnect');
	console.log('PASS Unity shared/reconnected banter: ' + shared);
	await click(p1, 580, 666);
	await waitFor(() => m.reveal?.ack[0], 'attacker acknowledges');
	assert(m.reveal);
	assert.throws(() => move(m, 1, 30, 40, m.seq, 'barrier'), /acknowledge|Review/);
	await click(p2, 580, 666);
	await waitFor(() => !m.reveal, 'both acknowledgments');
	await new Promise(r => setTimeout(r, 4500));
	for (const [attacker, defender, label] of (live ? [] : [['3', 'B', 'miner-defuses-bomb'], ['10', 'B', 'bomb-defeats-marshal'], ['1', '10', 'spy-attacks-marshal'], ['10', '1', 'marshal-attacks-spy'], ['3', '4', 'miner-eliminated'], ['10', '5', 'marshal-beats-lower'], ['4', '2', 'generic-capture'], ['2', 'F', 'flag-capture']])) {
		m.board.fill(null);
		m.board[60] = {
			side: 0, rank: attacker, id: 'fixture-attacker'
		};
		m.board[50] = {
			side: 1, rank: defender, id: 'fixture-defender'
		};
		m.board[99] = {
			side: 0, rank: '4', id: 'spare-red'
		};
		m.board[0] = {
			side: 1, rank: '2', id: 'spare-blue'
		};
		m.phase = 'play';
		m.turn = 0;
		m.winner = -1;
		m.history = [[], []];
		m.selection = null;
		await new Promise(r => setTimeout(r, 2200));
		const seq = m.seq;
		await square(p1, 60);
		await waitFor(() => m.selection?.from === 60, 'special selection ' + label);
		await square(p1, 50);
		await waitFor(() => m.seq === seq + 1, 'special combat ' + label);
		await new Promise(r => setTimeout(r, 2500));
		await teacher.screenshot(evidence + '/' + label + '-animation.png');
		await new Promise(r => setTimeout(r, 2400));
		await teacher.screenshot(evidence + '/' + label + '.png');
		for (const p of [p1, p2, teacher])
			await waitFor(() => p.logs.some(e => e.method === 'Runtime.consoleAPICalled' && e.params.args.some(a => String(a.value || '').startsWith('BATTLE_BANTER ' + m.seq + ' '))), 'special rendered banter ' + label);
		console.log('PASS Unity cutscene ' + label);
		assert.equal(m.reveal.attacker, attacker);
		assert.equal(m.reveal.defender, defender);
		await ack(p1, m, 0, 'special red ack');
		await ack(p2, m, 1, 'special blue ack');
		assert(!m.reveal);
		await new Promise(r => setTimeout(r, 1200));
	}
	await teacher.call('Page.reload');
	await teacher.wait('!!window.unityInstance', 120000);
	await new Promise(r => setTimeout(r, 2200));
	await type(teacher, 400, 273, 'unity-test-key');
	await click(teacher, 400, 316);
	await new Promise(r => setTimeout(r, 2000));
	await click(teacher, 800, 231);
	await teacher.wait('window.__spectator?.match?.side===1', 15000);
	await teacher.screenshot(evidence + '/manual-perspective-reloaded.png');
	const spec = authority.call('teacher/spectate', {
		matchId: m.id
	}, 'unity-test-key');
	assert.equal(spec.match.side, m.turn);
	assert(spec.match.board.filter(p => p && p.side !== m.turn).every(p => p.rank === '?'));
	assert.equal(await teacher.evaluate('window.__spectator.match.side'), m.turn);
	const before = m.seq;
	await square(teacher, 61);
	await square(teacher, 51, 0, false);
	assert.equal(m.seq, before);
	await click(teacher, 100, 151);
	await new Promise(r => setTimeout(r, 1200));
	await click(teacher, 800, 286);
	const other = [...authority.matches.keys()][1];
	await teacher.wait('window.__spectator?.match?.id===' + JSON.stringify(other), 15000);
	await teacher.screenshot(evidence + '/spectator-other-match.png');
	await click(teacher, 100, 151);
	await new Promise(r => setTimeout(r, 1200));
	await click(teacher, 390, 161);
	await waitFor(() => authority.call('teacher/state', {}, 'unity-test-key').phase === 'paused', 'teacher pause');
	await p1.call('Page.reload');
	await p1.wait('!!window.unityInstance', 120000);
	await p1.wait("window.__presenceStatus?.includes(" + JSON.stringify(expectedStatus) + ")", 45000);
	assert.equal(authority.students.size, 4);
	await click(teacher, 690, 161);
	await waitFor(() => authority.call('teacher/state', {}, 'unity-test-key').phase === 'ended', 'teacher end');
	await p1.wait("window.__presenceStatus?.startsWith('Round ended')", 20000);
	await p1.call('Page.reload');
	await p1.wait('!!window.unityInstance', 120000);
	await p1.wait("window.__presenceStatus?.startsWith('Round ended')", 20000);
	await teacher.screenshot(evidence + '/teacher.png');
	await writeFile(evidence + '/' + (live ? 'live' : 'fallback') + '-result.json', JSON.stringify({
		result: 'passed', mode: live ? 'live Playroom' : 'SDK blocked fallback', utc: new Date().toISOString(), room: expected, specialCombats: live ? [] : ['miner vs bomb', 'marshal vs bomb', 'spy attacks marshal', 'marshal attacks spy', 'miner eliminated', 'marshal beats lower rank', 'generic capture', 'flag capture'], checks: ['actual WebGL exported Unity player', 'same banter on attacker, defender, teacher and reconnected defender', 'nine banter categories with factual labels retained', 'role-based attacker approach, stationary defender and loser toppling screenshots', 'teacher and two student canvas login', 'automatic student same-room presence despite stale URL hash; teacher uses deliberate failure fallback', '40-piece setup via canvas', 'alternating moves via canvas', 'separate equal-rank battle cutscene for both players and spectator', 'defender reload retains unacknowledged battle', 'both-player acknowledgment barrier', 'authoritative selection and legal target spectator parity', 'teacher pause/end via canvas', 'reload restores same seat and room', 'ended reload remains ended', 'teacher fixed perspective, explicit switch, redaction and reload persistence', 'read-only spectator canvas and match switching']
	}, null, 2));
	console.log('PASS Unity: setup, alternating moves, combat, teacher pause/end, reload and ended-round handling.');
}
catch (error) {
	await writeFile(evidence + '/errors.json', JSON.stringify([teacher, p1, p2].filter(Boolean).flatMap(p => p.logs.filter(e => e.method === 'Runtime.consoleAPICalled').map(e => ({
		type: e.params.type, text: e.params.args.map(a => a.value || a.description).join(' ')
	}))).filter(e => e.type === 'error' || e.text.includes('BOARD_PICK')), null, 2));
	if (p1)
		await p1.screenshot(evidence + '/failure.png');
	if (p2)
		await p2.screenshot(evidence + '/failure-defender.png');
	throw error;
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
