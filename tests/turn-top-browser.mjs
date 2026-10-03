import http from 'node:http';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { launchBrowser } from './browser-helper.mjs';
import { createAuthority } from '../server/server.mjs';
import { army, move } from '../server/game.mjs';
const root = resolve(process.env.HISTORY_VISUAL_BUILD || 'Builds/MinerTurnRelease');
let clock=100000;
const a = createAuthority({
	teacherKey: 'isolated-fixture-only', classCode: 'QA', now: () => clock, timedSetup: false, timedTurns: true
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
 browser=await launchBrowser();const page=await browser.page('http://127.0.0.1:'+server.address().port+'/?qa=1',{width:1600,height:900,blockSdk:true,initScript:`sessionStorage.setItem('history.tips.${p[0].player}.${m.id}','1|1|0|0');sessionStorage.setItem('studentToken',${JSON.stringify(p[0].token)});window.historyPresenceStatus=()=> 'Isolated visual fixture';`});
 await page.wait('!!window.unityInstance',120000);await sleep(2200);
 const count=()=>page.logs.filter(e=>e.method==='Runtime.consoleAPICalled'&&JSON.stringify(e.params).includes('YOUR_TURN_NOTICE')).length;
 const wait=async(fn,label)=>{const end=Date.now()+15000;while(!fn()&&Date.now()<end)await sleep(30);assert(fn(),label);};
 const results=[];let focus=false;
 for(const [width,height,zoom]of [[1600,900,false],[390,844,false],[390,844,true],[844,390,true]]){
 await page.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(600);
 if(focus!==zoom){await page.evaluate("unityInstance.SendMessage('HistoryGame','ToggleBoardFocus')");focus=zoom;await page.wait('window.historyBoardFocusActive==='+zoom);}
 m.turn=1;m.seq++;let reads=stateReads;await wait(()=>stateReads>=reads+2,'opponent view');await sleep(500);
 const before=count();clock+=10001;m.turn=0;m.seq++;a.call('emote',{matchId:m.id,emoteId:'greeting'},p[1].token);await wait(()=>count()>before,'turn notice');await sleep(100);
 const screenshot=`Logs/turn-top-${width}x${height}-${zoom?'zoom':'normal'}.png`;await page.screenshot(screenshot);results.push({width,height,zoom,screenshot});
 }
 assert.equal(ackCalls,0);assert.equal(page.logs.filter(e=>e.method==='Runtime.exceptionThrown').length,0);await writeFile('Logs/turn-top-result.json',JSON.stringify({passed:true,results,ackCalls,localFixture:true},null,2));console.log('Four actual Unity turn/friendly notice screenshots captured; no browser exceptions.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}


