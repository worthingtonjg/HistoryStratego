import http from 'node:http';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { launchBrowser } from './browser-helper.mjs';
import { createAuthority } from '../server/server.mjs';
import { army, move } from '../server/game.mjs';
const root = resolve(process.env.HISTORY_VISUAL_BUILD || 'Builds/HistoryMemoryRelease');
let clock=100000;
const a = createAuthority({
	teacherKey: 'isolated-fixture-only', classCode: 'QA', now: () => clock, timedSetup: false, timedTurns: false
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
m.board.fill(null);delete m.decisionMemory;
for(const [at,side,rank]of[[60,0,'6'],[39,1,'6'],[99,0,'F'],[0,1,'F']])m.board[at]={id:'p'+at,side,rank};
let index=0;
const advance=n=>{for(let i=0;i<n;i++,index++){const side=index%2,k=Math.floor(index/2),from=side===0?60:39,to=side===0?70:29;move(m,side,k%2?to:from,k%2?from:to,m.seq,'qa-'+index);}};
advance(40);




let stateReads=0,emoteCalls=0,ackCalls=0;
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
			if(route==='emote')emoteCalls++;if(route==='ack')ackCalls++;
			const result = a.call(route, JSON.parse(text || '{}'), (req.headers.authorization || '').replace('Bearer ', ''));
			if (route === 'state')
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
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try {
 browser=await launchBrowser();const page=await browser.page('http://127.0.0.1:'+server.address().port+'/?qa=1',{width:1920,height:860,blockSdk:true,initScript:`sessionStorage.setItem('studentToken',${JSON.stringify(p[0].token)});window.historyPresenceStatus=()=> 'Isolated history fixture';`});
 await page.wait('!!window.unityInstance',120000);await sleep(2300);
 const click=async(x,y)=>{const pos=await page.evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),s=Math.min(r.width/1200,r.height/900);return{x:r.left+(r.width-1200*s)/2+${x}*s,y:r.top+(r.height-900*s)/2+${y}*s}})()`);for(const type of ['mousePressed','mouseReleased']){await page.call('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...pos});await sleep(80);}};
 await click(1090,207);await sleep(500);await page.screenshot('Logs/history-unity-log.png');
 const before=stateReads;advance(80);await sleep(2500);assert(stateReads>before);assert.equal(m.events.length,20);await page.screenshot('Logs/history-unity-gap.png');
 await page.call('Page.reload');await page.wait('!!window.unityInstance',120000);await sleep(2300);await click(1090,207);await sleep(400);await page.screenshot('Logs/history-unity-reload.png');
 m.combats=[{kind:'combat',seq:1,side:0,from:60,to:50,attacker:'2',defender:'B',outcome:-1,text:'Scout attacks Bomb: defender holds',ack:[false,true],released:[false,false]}];m.reveal=m.combats[0];
 await sleep(2600);assert(page.logs.some(e=>JSON.stringify(e).includes('BATTLE_BANTER 1')),'Old pending battle did not render');await page.screenshot('Logs/history-unity-pending-combat.png');
 const exceptions=page.logs.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(exceptions.length,0);
 assert(!page.logs.some(e=>JSON.stringify(e).includes('NullReferenceException')));
 await writeFile('Logs/history-unity-result.json',JSON.stringify({passed:true,sequence:m.seq,retainedMoves:m.events.length,stateReads,exceptions:exceptions.length,width:1920,height:860,isolatedFixture:true,screenshots:['Logs/history-unity-log.png','Logs/history-unity-gap.png','Logs/history-unity-reload.png','Logs/history-unity-pending-combat.png']},null,2));console.log('Unity rendered rolling history, caught up across 80 moves, and reloaded without exceptions.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
