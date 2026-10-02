import http from 'node:http';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { launchBrowser } from './browser-helper.mjs';
import { createAuthority } from '../server/server.mjs';
import { army, move } from '../server/game.mjs';
const root = resolve(process.env.HISTORY_VISUAL_BUILD || 'Builds/NeutralSpectatorRelease');
const a = createAuthority({
	teacherKey: 'isolated-fixture-only', classCode: 'QA', now: () => 100000, timedSetup: false, timedTurns: false
});
const p = [a.call('join', {
	classCode: 'QA'
}), a.call('join', {
	classCode: 'QA'
})];
a.call('teacher/start', {}, 'isolated-fixture-only');
for (const player of p)
	a.call('setup', {
		ranks: army()
	}, player.token);
const m = [...a.matches.values()][0];
m.playerNames = ['J. E. B. Stuart', 'Webb'];
m.commanders[0].fullName = 'James Ewell Brown Stuart';
m.commanders[1].fullName = 'Alexander Stewart Webb';
let stateReads = 0;
const mime = {
	'.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.data': 'application/octet-stream', '.json': 'application/json'
};
const server = http.createServer(async (req, res) => {
	try {
		const pathname = new URL(req.url, 'http://localhost').pathname;
		if (pathname.startsWith('/api/')) {
			let text = '';
			for await (const c of req)
				text += c;
			const route = pathname.slice(5);
			const result = a.call(route, JSON.parse(text || '{}'), route.startsWith('teacher/') ? 'isolated-fixture-only' : (req.headers.authorization || '').replace('Bearer ', ''));
			if (route === 'teacher/state')
				stateReads++;
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(result));
			return;
		}
		const file = pathname === '/facts.json' ? resolve('web/facts.json') : resolve(root, pathname === '/' ? 'index.html' : '.' + pathname);
		if (file !== resolve('web/facts.json') && !file.startsWith(root + '\\'))
			throw Error('path');
		res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
		res.end(await readFile(file));
	}
	catch (e) {
		res.statusCode = 404;
		res.end('Fixture request unavailable');
	}
}).listen(0, '127.0.0.1');
await new Promise(r => server.on('listening', r));
let browser;
try {
	browser = await launchBrowser();
	const page = await browser.page('http://127.0.0.1:' + server.address().port + '/?qa=1', {
		width: 844, height: 390, initScript: `window.historyPresenceStatus=()=> 'Isolated visual fixture';`
	});
	await page.wait('!!window.unityInstance', 120000);
	await new Promise(r=>setTimeout(r,2200));
 const point=async(x,y)=>page.evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),s=Math.min(r.width/1200,r.height/900);return{x:r.left+(r.width-1200*s)/2+${x}*s,y:r.top+(r.height-900*s)/2+${y}*s}})()`);
 const click=async(x,y)=>{await page.evaluate("unityInstance.SendMessage('HistoryGame','WakeRendering')");const q=await point(x,y);await page.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...q});await new Promise(r=>setTimeout(r,100));await page.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...q});};
 await click(440,272);await new Promise(r=>setTimeout(r,200));await page.call('Input.insertText',{text:'isolated-fixture-only'});await new Promise(r=>setTimeout(r,250));await click(400,315);
 const end = Date.now() + 20000;
	while (stateReads < 2 && Date.now() < end)
		await new Promise(r => setTimeout(r, 300));
	await page.screenshot('Logs/capture-login-diagnostic.png');assert(stateReads >= 2, 'Unity did not poll fixture state');
	await new Promise(r => setTimeout(r, 1800));
 const seq=m.seq;await click(997,218);await page.wait('window.historyBoardFocusAvailable===true');
 const spectate=()=>a.call('teacher/spectate',{matchId:m.id},'isolated-fixture-only').match;
 assert.equal(spectate().side,-1);assert(spectate().board.every(p=>!p||p.rank==='?'));await new Promise(r=>setTimeout(r,800));await page.screenshot('Logs/tile-neutral-normal.png');
 const tap=async(x,y)=>{await page.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x,y});await new Promise(r=>setTimeout(r,100));await page.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x,y});};
 await click(1075,91);await page.wait('window.historyBoardFocusActive===true');await new Promise(r=>setTimeout(r,500));await page.screenshot('Logs/tile-neutral-focused.png');
 for(const side of [1,0,-1]){await tap(500,350);await new Promise(r=>setTimeout(r,700));assert.equal(spectate().side,side);assert(spectate().board.every(p=>!p||(p.side===side?p.rank!=='?':p.rank==='?')));assert.equal(m.seq,seq);}
 await page.screenshot('Logs/tile-neutral-cycle-return.png');await tap(70,350);await page.wait('window.historyBoardFocusActive===false');await page.screenshot('Logs/tile-neutral-internal-toggle.png');
 const stable=m.seq===seq;m.board[60]={id:'qa-attacker',side:0,rank:'6'};m.board[50]={id:'qa-defender',side:1,rank:'4'};move(m,0,60,50,m.seq,'neutral-visual-combat');await new Promise(r=>setTimeout(r,3400));assert.equal(spectate().side,-1);assert.equal(spectate().battle.attacker,'6');assert(spectate().board.every(p=>!p||p.rank==='?'));assert.deepEqual(m.reveal.ack,[false,false]);await page.screenshot('Logs/tile-neutral-public-combat.png');
 await writeFile('Logs/tile-neutral-spectator-visual-result.json',JSON.stringify({defaultSide:-1,cycle:[1,0,-1],internalToggle:true,readOnly:true,sequenceUnchanged:stable,publicCombat:true}));
 const exceptions = page.logs.filter(x => x.method === 'Runtime.exceptionThrown');
	await writeFile('Logs/tile-neutral-spectator-unity-result.json', JSON.stringify({
		stateReads, exceptions: exceptions.length, screenshot: 'Logs/capture-teacher-card.png', fixtureOnly: true
	}, null, 2));
	assert.equal(exceptions.length, 0);
	console.log('Actual Unity fixture rendered; screenshot ready for pixel inspection.');
}
finally {
	if (browser)
		await browser.close();
	await new Promise(r => server.close(r));
}
