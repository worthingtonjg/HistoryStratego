import {tileUV} from './tile-projection.mjs';
import http from 'node:http';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { launchBrowser } from './browser-helper.mjs';
import { createAuthority } from '../server/server.mjs';
import { army } from '../server/game.mjs';
const root = resolve(process.env.HISTORY_VISUAL_BUILD || 'Builds/FlagEntryRelease');
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


 await page.wait('window.historyBoardFocusAvailable===true');
 const pause=ms=>new Promise(r=>setTimeout(r,ms)),state=()=>a.call('state',{},p[side].token).match;
 const wait=async(fn,label)=>{const end=Date.now()+10000;while(Date.now()<end){if(fn())return;await pause(100);}throw Error('Timeout '+label);};
 const logCount=()=>page.logs.filter(e=>e.method==='Runtime.consoleAPICalled'&&e.params.args.some(a=>String(a.value).includes('FLAG_PRESELECTED'))).length;
 await wait(()=>logCount()===1,'initial flag');let focus=false;
 const point=async(x,y)=>page.evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),s=Math.min(r.width/1200,r.height/900);return{x:r.left+(r.width-1200*s)/2+${x}*s,y:r.top+(r.height-900*s)/2+${y}*s}})()`);
 const tap=async(q,touch=false)=>{if(touch){await page.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await page.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...q,id:1,radiusX:4,radiusY:4,force:1}]});await pause(90);await page.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await page.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...q});await pause(90);await page.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...q});}};
 const cell=async(k)=>{const[u,v]=tileUV(60+k,0,focus?1:1400/899,state().setup.draft[k]!=null);return focus?page.evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),s=Math.min(r.width,r.height);return{x:r.left+(r.width-s)/2+${u}*s,y:r.top+(r.height-s)/2+${1-v}*s}})()`):point(25+u*865,178+(1-v)*555);};
 const initial=state().setup;assert(initial.draft.indexOf('F')>=30);await page.screenshot(`Logs/flag-entry-side${side}-normal.png`);
 await tap(await cell(0));await wait(()=>state().setup.draft[0]==='F','first destination moves flag');assert.equal(swapCalls,1);assert.equal(state().setup.stage,1);assert(!state().ready[side]);await pause(1600);await tap(await cell(1));await pause(700);assert.equal(swapCalls,1,'polling must not select flag again');assert.equal(logCount(),1);
 await tap(await cell(0));await tap(await cell(0));await pause(1300);await tap(await cell(2));await pause(500);assert.equal(swapCalls,1,'intentional deselection survives polls');
 const count=logCount();await page.call('Page.reload');await page.wait('!!window.unityInstance',120000);await wait(()=>logCount()===count+1,'reload current flag preselection');assert.equal(state().setup.draft[0],'F');
 await page.call('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:false});await page.evaluate("unityInstance.SendMessage('HistoryGame','ToggleBoardFocus')");await page.wait('window.historyBoardFocusActive===true');focus=true;await pause(700);await page.screenshot(`Logs/flag-entry-side${side}-zoom.png`);await tap(await cell(9),true);await wait(()=>state().setup.draft[9]==='F','zoom touch first destination');assert.equal(swapCalls,2);await pause(600);
 await page.call('Emulation.setTouchEmulationEnabled',{enabled:false});await page.evaluate("unityInstance.SendMessage('HistoryGame','ToggleBoardFocus')");await page.wait('window.historyBoardFocusActive===false');focus=false;await page.call('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false});await pause(600);await tap(await point(1040,815));await wait(()=>state().setup.stage===2,'manual Next');const logs=logCount();await pause(1300);assert.equal(logCount(),logs);await tap(await cell(9));await tap(await cell(20));await wait(()=>state().setup.draft[20]==='F','earlier flag stays editable');assert.equal(state().setup.stage,2);assert.equal(state().setup.draft.filter(Boolean).length,7);assert(!state().ready[side]);
 await writeFile(`Logs/flag-entry-side${side}-result.json`,JSON.stringify({passed:true,side,initialBackRow:true,firstDestinationMoves:true,normal:true,zoomTouch:true,noReselectOnPoll:true,deselectionPreserved:true,reloadSelectsCurrentFlag:true,noAutomaticNextReady:true,phaseTwoEditable:true,livePlayroom:false}));

 const exceptions = page.logs.filter(x => x.method === 'Runtime.exceptionThrown');
	await writeFile('Logs/flag-entry-unity-side'+side+'-result.json', JSON.stringify({
		stateReads, exceptions: exceptions.length, screenshots: 'Logs/tile-phase*.png', fixtureOnly: true
	}, null, 2));
	assert.equal(exceptions.length, 0);
	console.log('Actual Unity fixture rendered; screenshot ready for pixel inspection.');
}
finally {
	if (browser)
		await browser.close();
	await new Promise(r => server.close(r));
}
