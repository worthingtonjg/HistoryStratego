import {tileUV} from './tile-projection.mjs';
import http from 'node:http';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { launchBrowser } from './browser-helper.mjs';
import { createAuthority } from '../server/server.mjs';
import { army } from '../server/game.mjs';
const root = resolve(process.env.HISTORY_VISUAL_BUILD || 'Builds/LowTileRelease');
const side=Number(process.env.HISTORY_FOCUS_SIDE||0);
const a = createAuthority({
	teacherKey: 'isolated-fixture-only', classCode: 'QA', now: () => 100000, timedSetup: false, timedTurns: false
});
const p = [a.call('join', {
	classCode: 'QA'
}), a.call('join', {
	classCode: 'QA'
})];
a.call('teacher/start', {}, 'isolated-fixture-only');
const ranks=army(),front=['B','F','6','2','3'];for(const rank of front)ranks.splice(ranks.indexOf(rank),1);for(const player of p)a.call('setup',{ranks:[...front,...ranks]},player.token);
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

 await page.wait('window.historyBoardFocusAvailable===true');await new Promise(r=>setTimeout(r,700));
 const prefix='tile-play',pause=ms=>new Promise(r=>setTimeout(r,ms));
 for(const [width,height] of [[1920,900],[1366,768],[390,844],[844,390]]){
  await page.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(500);
  await page.screenshot(`Logs/${prefix}-side${side}-${width}-normal.png`);
  await page.evaluate("unityInstance.SendMessage('HistoryGame','ToggleBoardFocus')");await page.wait('window.historyBoardFocusActive===true');await pause(500);await page.screenshot(`Logs/${prefix}-side${side}-${width}-zoom.png`);
  await page.evaluate("unityInstance.SendMessage('HistoryGame','ToggleBoardFocus')");await page.wait('window.historyBoardFocusActive===false');
 }
 assert(a.call('state',{},p[side].token).match.board.every(v=>!v||v.side===side||v.rank==='?'));
 const point=async(cell,focus,piece=true)=>{const [u,v]=tileUV(cell,side,focus?1:1400/899,piece);return page.evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();if(${focus}){const s=Math.min(r.width,r.height);return{x:r.left+(r.width-s)/2+${u}*s,y:r.top+(r.height-s)/2+${1-v}*s}}const s=Math.min(r.width/1200,r.height/900);return{x:r.left+(r.width-1200*s)/2+(25+${u}*865)*s,y:r.top+(r.height-900*s)/2+(178+${1-v}*555)*s}})()`);};
 const touch=async(q)=>{await page.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...q,radiusX:3,radiusY:3,id:0,force:1}]});await pause(90);await page.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
 const wait=async(fn)=>{const until=Date.now()+7000;while(!fn()&&Date.now()<until)await pause(150);assert(fn());};
 for(const [width,height,focus] of [[1600,900,false],[390,844,true],[844,390,true]]){
  await page.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  if(focus!==await page.evaluate('window.historyBoardFocusActive===true'))await page.evaluate("unityInstance.SendMessage('HistoryGame','ToggleBoardFocus')");
  m.board.fill(null);m.turn=side;m.phase='play';m.reveal=null;m.selection=null;m.history=[[],[]];m.seq++;
  for(const i of [0,9,90,99])m.board[i]={id:'corner-'+i,side,rank:'2'};
  m.board[55]={id:'enemy',side:1-side,rank:'2'};await pause(1800);
  for(const i of [0,9,90,99]){await touch(await point(i,focus));await pause(600);await page.screenshot(`Logs/tile-pick-${side}-${width}-${i}.png`);await wait(()=>m.selection?.from===i);}
  const seq=m.seq;await touch(await point(89,focus,false));await wait(()=>m.seq===seq+1);assert.equal(m.board[89]?.side,side);assert.equal(m.board[99],null);await pause(800);
  await page.screenshot(`Logs/${prefix}-side${side}-${width}-touch-move.png`);
 }
 await writeFile(`Logs/tile-gameplay-side${side}.json`,JSON.stringify({side,viewports:4,cornerTouches:12,legalMoves:3,privacy:true,livePlayroom:false}));

 const exceptions = page.logs.filter(x => x.method === 'Runtime.exceptionThrown');
	await writeFile('Logs/'+prefix+'-side'+side+'-result.json', JSON.stringify({
		stateReads, exceptions: exceptions.length, screenshots: 'Logs/'+prefix+'-side'+side+'-*.png', fixtureOnly: true
	}, null, 2));
	assert.equal(exceptions.length, 0);
	console.log('Actual Unity fixture rendered; screenshot ready for pixel inspection.');
}
finally {
	if (browser)
		await browser.close();
	await new Promise(r => server.close(r));
}
