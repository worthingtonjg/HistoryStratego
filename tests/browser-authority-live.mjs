import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { launchBrowser } from './browser-helper.mjs';
const root = resolve('Builds/BrowserRelease/docs'), mime = {
	'.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.wasm': 'application/wasm', '.json': 'application/json', '.data': 'application/octet-stream'
};
const requests = [];
const server = http.createServer(async (req, res) => {
	requests.push(req.url);
	try {
		const url = new URL(req.url, 'http://localhost'), relative = decodeURIComponent(url.pathname).replace(/^\/HistoryStratego\//, '');
		const path = resolve(root, relative);
		if (!path.startsWith(root + '/') && !path.startsWith(root + '\\'))
			throw Error('path');
		res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
		res.end(await readFile(path));
	}
	catch {
		res.statusCode = 404;
		res.end('Not found');
	}
}).listen(0, '127.0.0.1');
await new Promise(r => server.on('listening', r));
const url = 'http://127.0.0.1:' + server.address().port + '/HistoryStratego/index.html', evidence = 'Logs/browser-live-' + Date.now();
await mkdir(evidence, {
	recursive: true
});
let browser;
const pages = [];
try {
	browser = await launchBrowser();
	const teacher = await browser.page(url, {
		initScript: "Object.defineProperty(document,'hidden',{get:()=>window.qaHidden||false});"
	});
	pages.push(teacher);
	await teacher.call('Network.enable');
	await teacher.evaluate("document.querySelector('#create').click()");
	await teacher.wait('!!window.historyClassroom', 45000);
	const code = await teacher.evaluate('historyClassroom.code');
	console.log('Teacher classroom connected');
	await teacher.wait('!!window.unityInstance', 120000);
	await teacher.wait("document.querySelector('#entry').hidden");
	await new Promise(r => setTimeout(r, 1500));
	// Keep private recovery details collapsed and out of artifacts.
	await teacher.screenshot(evidence + '/teacher-waiting.png');
	for (let i = 0; i < 2; i++) {
		const p = await browser.page(url);
		pages.push(p);
		await p.call('Network.enable');
		await p.evaluate(`document.querySelector('#join-code').value=${JSON.stringify(code)};document.querySelector('#join').click()`);
		await p.wait('!!window.historyClassroom', 45000);
		await p.wait('!!window.unityInstance', 120000);
		await p.wait("!!sessionStorage.getItem('studentToken')", 45000);
	}
	const own = p => p.evaluate("historyClassroom.request('state',{},sessionStorage.getItem('studentToken'))");
	const roster = await teacher.evaluate("historyClassroom.request('teacher/state')");
	assert.equal(roster.roster.length, 2);
	assert.equal(roster.phase, 'waiting');
	await teacher.evaluate("historyClassroom.request('teacher/randomize')");
	await teacher.evaluate("historyClassroom.request('teacher/start')");
	let states = await Promise.all(pages.slice(1).map(own));
	assert(states.every(s => s.match.phase === 'setup'));
	for (const p of pages.slice(1))
		await p.evaluate("(async()=>{const t=sessionStorage.getItem('studentToken');let s=await historyClassroom.request('state',{},t);await historyClassroom.request('setup/begin',{matchId:s.match.id},t);s=await historyClassroom.request('state',{},t);return historyClassroom.request('setup',{matchId:s.match.id,revision:s.match.setup.revision},t)})()");
	states = await Promise.all(pages.slice(1).map(own));
	assert(states.every(s => s.match.ready.every(Boolean)));
	await new Promise(r => setTimeout(r, 2600));
	const active = pages[states.findIndex(s => s.match.side === 0) + 1];
	const move = await active.evaluate("(async()=>{const token=sessionStorage.getItem('studentToken');let s=await historyClassroom.request('state',{},token);for(let i=0;i<100;i++){const p=s.match.board[i];if(p?.side!==s.match.side||!/^([1-9]|10)$/.test(p.rank))continue;const selected=await historyClassroom.request('select',{from:i,seq:s.match.seq},token);const target=selected.match?.selection?.targets?.[0];if(target)return historyClassroom.request('move',{from:i,to:target.to,seq:s.match.seq,requestId:crypto.randomUUID()},token);}throw Error('No opening')})()");
	assert(!move.error, move.error);
	assert.equal(move.match.turn, 1);
	await teacher.evaluate("window.qaHidden=true;document.dispatchEvent(new Event('visibilitychange'))");
	states = await Promise.all(pages.slice(1).map(own));
	assert(states.every(s => s.phase === 'paused'));
	for (const s of states) {
		assert(s.match.board.filter(p => p && p.side !== s.match.side).every(p => p.rank === '?'));
	}
	await new Promise(r => setTimeout(r, 1700));
	await pages[1].screenshot(evidence + '/student-board.png');
	const denied = await pages[1].evaluate("historyClassroom.request('teacher/start')");
	assert(denied.error);
	// A transport host change never promotes teacher: role remains fixed and remote teacher routes fail.
	assert.equal(await pages[1].evaluate('historyClassroom.role'), 'student');
	// Transfer transport host to a student. Application teacher ownership stays unchanged.
	const sdkUrl = 'https://esm.sh/playroomkit@0.0.97?bundle';
	const studentId = await pages[1].evaluate(`import(${JSON.stringify(sdkUrl)}).then(s=>s.myPlayer().id)`);
	await teacher.evaluate(`import(${JSON.stringify(sdkUrl)}).then(s=>s.transferHost(${JSON.stringify(studentId)}))`);
	assert.equal(await pages[1].evaluate('historyClassroom.role'), 'student');
	assert((await pages[1].evaluate("historyClassroom.request('teacher/resume')")).error);
	// Isolated teacher-owned fixture for actual Unity final-combat/auto-continue rendering.
	await teacher.evaluate("(()=>{window.qaHidden=false;const a=historyClassroom.authority,m=[...a.matches.values()][0];m.board.fill(null);for(const [i,side,rank]of [[60,0,'5'],[50,1,'4'],[99,0,'F'],[0,1,'F'],[1,1,'B']])m.board[i]={id:'final-'+i,side,rank};m.phase='play';m.turn=0;m.setupClocks=null;m.turnClock=null;m.ready=[true,true];m.events=[];m.reveal=null;m.selection=null;m.history=[[],[]];m.seq++;return historyClassroom.request('teacher/resume');})()");
	await active.evaluate("(async()=>{const token=sessionStorage.getItem('studentToken'),s=await historyClassroom.request('state',{},token);return historyClassroom.request('move',{from:60,to:50,seq:s.match.seq,requestId:crypto.randomUUID()},token)})()");
	await new Promise(r => setTimeout(r, 3500));
	await active.screenshot(evidence + '/final-combat.png');
	for (let n = 0; n < 80; n++) {
		const s = await own(active);
		if (!s.match.battle)
			break;
		await new Promise(r => setTimeout(r, 250));
	}
	const finalState = await own(active);
	assert.equal(finalState.match.phase, 'over');
	assert(!finalState.match.battle, 'actual Unity clients completed their own automatic acknowledgments');
	await new Promise(r => setTimeout(r, 1000));
	await active.screenshot(evidence + '/final-result.png');
	await teacher.evaluate("historyClassroom.request('teacher/state')");
	await teacher.call('Page.reload');
	await teacher.wait("!!document.querySelector('#reconnect') && !document.querySelector('#reconnect').hidden", 20000);
	await teacher.evaluate("document.querySelector('#reconnect').click()");
	await teacher.wait('!!window.historyClassroom', 45000);
	await teacher.wait('!!window.unityInstance', 120000);
	await new Promise(r => setTimeout(r, 1000));
	assert.equal((await teacher.evaluate("historyClassroom.request('teacher/state')")).phase, 'paused');
	assert.equal((await own(active)).match.phase, 'over');
	await new Promise(r => setTimeout(r, 9000));
	await teacher.screenshot(evidence + '/teacher-recovered.png');
	assert(!requests.some(p => p.startsWith('/api/') || p === '/facts.json'), 'no HTTP authority dependency');
	await writeFile(evidence + '/result.json', JSON.stringify({
		result: 'passed', checks: ['live Playroom teacher and two students', 'Unity teacher/student runtime', 'randomize and Start', 'own setup and alternating legal move', 'redacted hidden ranks', 'pause and remote teacher rejection', 'no HTTP API/facts root requests', 'teacher visibility loss pauses', 'student transport-host migration does not gain authority', 'actual Unity final combat and automatic acknowledgments', 'same-browser encrypted teacher recovery after reload'], code
	}, null, 2));
	console.log('PASS ' + evidence);
}
catch (e) {
	await writeFile(evidence + '/failure.txt', e.stack || String(e));
	await writeFile(evidence + '/http-paths.json', JSON.stringify(requests));
	for (let i = 0; i < pages.length; i++) {
		try {
			await pages[i].screenshot(evidence + '/failure-' + i + '.png');
			const status = await pages[i].evaluate("document.querySelector('#status')?.textContent");
			console.log('page ' + i + ' status ' + status);
			console.log(await pages[i].evaluate('JSON.stringify({transport:window.historyTransportDebug,fetchError:window.historyFetchError,apiOrigin:window.historyApiOrigin})'));
		}
		catch {
		}
	}
	throw e;
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
