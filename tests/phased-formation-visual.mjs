import http from 'node:http';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { launchBrowser } from './browser-helper.mjs';
import { createAuthority } from '../server/server.mjs';
import { army } from '../server/game.mjs';
const root = resolve(process.env.HISTORY_VISUAL_BUILD || 'Builds/PhasedFormationRelease');
const side=Number(process.env.HISTORY_FOCUS_SIDE||0);let clock=100000;
const a = createAuthority({
	teacherKey: 'isolated-fixture-only', classCode: 'QA', now: () => clock, timedSetup: true, timedTurns: false
});
const p = [a.call('join', {
	classCode: 'QA'
}), a.call('join', {
	classCode: 'QA'
})];
a.call('teacher/start', {}, 'isolated-fixture-only');
a.call('setup/begin', {matchId:[...a.matches.keys()][0]}, p[side].token);
const m = [...a.matches.values()][0];
m.playerNames = ['J. E. B. Stuart', 'Webb'];
m.commanders[0].fullName = 'James Ewell Brown Stuart';
m.commanders[1].fullName = 'Alexander Stewart Webb';
let stateReads = 0, swapCalls = 0, slow=false, reading=false, rejectNext=false;
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
			if(route==='setup/swap') swapCalls++;
			if(route==='setup/swap'&&rejectNext){rejectNext=false;await new Promise(r=>setTimeout(r,700));res.statusCode=400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Fixture rejected swap'}));return;}
			const result = a.call(route, JSON.parse(text || '{}'), (req.headers.authorization || '').replace('Bearer ', ''));
			if (route === 'state')
				stateReads++;
			if(slow && route==='state'){reading=true;await new Promise(r=>setTimeout(r,1400));reading=false;}if(slow && route==='setup/swap')await new Promise(r=>setTimeout(r,700));
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
		width: 1600, height: 900, initScript: `sessionStorage.setItem('studentToken',${JSON.stringify(p[side].token)});window.historyPresenceStatus=()=> 'Isolated visual fixture';`
	});
	await page.wait('!!window.unityInstance', 120000);
	const end = Date.now() + 20000;
	while (stateReads < 2 && Date.now() < end)
		await new Promise(r => setTimeout(r, 300));
	assert(stateReads >= 2, 'Unity did not poll fixture state');
	await new Promise(r => setTimeout(r, 1800));

 await page.wait('window.historyBoardFocusAvailable===true');await page.screenshot('Logs/phase1-normal.png');
 const state=()=>a.call('state',{},p[side].token).match;
 assert.equal(state().setup.stage,1);assert.equal(state().setup.draft.filter(Boolean).length,1);
 const point=async(x,y)=>page.evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),s=Math.min(r.width/1200,r.height/900);return{x:r.left+(r.width-1200*s)/2+${x}*s,y:r.top+(r.height-900*s)/2+${y}*s}})()`);
 const tap=async(q)=>{await page.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...q});await new Promise(r=>setTimeout(r,80));await page.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...q});};
 const focus=async()=>{await tap(await point(1075,91));await page.wait('window.historyBoardFocusActive===true');await new Promise(r=>setTimeout(r,500));};
 const cell=async(k)=>{const n=60+k,x=n%10-4.5,z=4.5-Math.floor(n/10)-.11,y=.645,len=Math.hypot(13.85,13),u=.5+x/11.2,v=.5+((y-14)*13/len+(z+13)*13.85/len)/11.2;return page.evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),s=Math.min(r.width,r.height);return{x:r.left+(r.width-s)/2+${u}*s,y:r.top+(r.height-s)/2+${1-v}*s}})()`);};
 const swap=async(from,to)=>{await tap(await cell(from));await tap(await cell(to));await new Promise(r=>setTimeout(r,1000));};
 const next=async()=>{await tap({x:1000,y:865});await new Promise(r=>setTimeout(r,900));};
 await focus();const initial=state().setup,flag=initial.draft.indexOf('F');slow=true;await swap(flag,0);slow=false;await new Promise(r=>setTimeout(r,1600));assert.equal(state().setup.draft[0],'F');assert.equal(swapCalls,1);assert(page.logs.some(x=>JSON.stringify(x).includes('SETUP_SWAP_PREVIEW')));
 clock+=61000;await next();assert.equal(state().setup.stage,2);assert.equal(state().setup.draft.filter(Boolean).length,7);assert.equal(state().setup.draft[0],'F');await swap(0,9);assert.equal(state().setup.draft[9],'F');
 await tap({x:65,y:865});await page.wait('window.historyBoardFocusActive===false');await page.screenshot('Logs/phase2-normal.png');assert.equal(state().setup.remainingMs,239000);
 const draft=[...state().setup.draft],deadline=state().setup.deadline,reads=stateReads;await page.call('Page.reload');await page.wait('!!window.unityInstance',120000);const until=Date.now()+20000;while(stateReads<reads+2&&Date.now()<until)await new Promise(r=>setTimeout(r,200));await new Promise(r=>setTimeout(r,1000));assert.deepEqual(state().setup.draft,draft);assert.equal(state().setup.stage,2);assert.equal(state().setup.deadline,deadline);await page.screenshot('Logs/phase2-reload.png');
 await tap(await point(1040,815));await new Promise(r=>setTimeout(r,900));assert.equal(state().setup.stage,3);draft.forEach((r,i)=>{if(r)assert.equal(state().setup.draft[i],r);});assert.equal(state().setup.draft.filter(Boolean).length,40);await page.screenshot('Logs/phase3-normal.png');
 await focus();await swap(9,20);assert.equal(state().setup.draft[20],'F');
 a.call('teacher/pause',{},'isolated-fixture-only');await new Promise(r=>setTimeout(r,1100));const swaps=swapCalls;await swap(20,21);assert.equal(swapCalls,swaps);a.call('teacher/resume',{},'isolated-fixture-only');await new Promise(r=>setTimeout(r,1100));
 await tap({x:65,y:865});await page.wait('window.historyBoardFocusActive===false');await tap(await point(1040,815));await new Promise(r=>setTimeout(r,1200));assert(state().ready[state().side]);assert.equal(state().phase,'setup');await page.screenshot('Logs/phase-ready.png');
 a.call('teacher/npc',{a:p[1-side].player},'isolated-fixture-only');a.call('teacher/setup-npc',{a:p[1-side].player,matchId:m.id},'isolated-fixture-only');assert.equal(state().phase,'play');
 await writeFile('Logs/phased-visual-result.json',JSON.stringify({side,threeStages:true,movableEarlierPieces:true,slowPollPreview:true,reloadPhase:true,sharedDeadline:true,pausedSwapBlocked:true,ready:true,npcOpponentReady:true,swapCalls,livePlayroom:false}));

 const exceptions = page.logs.filter(x => x.method === 'Runtime.exceptionThrown');
	await writeFile('Logs/phased-unity-result.json', JSON.stringify({
		stateReads, exceptions: exceptions.length, screenshots: 'Logs/phase*.png', fixtureOnly: true
	}, null, 2));
	assert.equal(exceptions.length, 0);
	console.log('Actual Unity fixture rendered; screenshot ready for pixel inspection.');
}
finally {
	if (browser)
		await browser.close();
	await new Promise(r => server.close(r));
}
