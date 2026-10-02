import http from 'node:http';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { launchBrowser } from './browser-helper.mjs';
import { createAuthority } from '../server/server.mjs';
import { army } from '../server/game.mjs';
const root = resolve(process.env.HISTORY_VISUAL_BUILD || 'Builds/BoardFocusFinal');
const side=Number(process.env.HISTORY_FOCUS_SIDE||0);
const a = createAuthority({
	teacherKey: 'isolated-fixture-only', classCode: 'QA', now: () => 100000, timedSetup: true, timedTurns: false
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
		width: 390, height: 844, initScript: `sessionStorage.setItem('studentToken',${JSON.stringify(p[side].token)});window.historyPresenceStatus=()=> 'Isolated visual fixture';`
	});
	await page.wait('!!window.unityInstance', 120000);
	const end = Date.now() + 20000;
	while (stateReads < 2 && Date.now() < end)
		await new Promise(r => setTimeout(r, 300));
	assert(stateReads >= 2, 'Unity did not poll fixture state');
	await new Promise(r => setTimeout(r, 1800));
 await page.wait('window.historyBoardFocusAvailable===true');assert.equal(await page.evaluate('window.historyBoardFocusActive'),false);
 await page.evaluate("unityInstance.SendMessage('HistoryGame','ToggleBoardFocus')");await page.wait('window.historyBoardFocusActive===true');await new Promise(r=>setTimeout(r,800));
 await page.screenshot('Logs/focus-portrait.png');
 const touch=process.env.HISTORY_TOUCH==='1';if(touch)await page.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 const clickPixel=async(q)=>{if(touch){await page.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...q,id:0,radiusX:3,radiusY:3,force:1}]});await new Promise(r=>setTimeout(r,100));await page.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await page.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...q});await new Promise(r=>setTimeout(r,100));await page.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...q});}};
 const cell=async(k)=>{const n=60+k,x=n%10-4.5,z=4.5-Math.floor(n/10)-.11,y=.645,len=Math.hypot(13.85,13),u=.5+x/11.2,v=.5+((y-14)*13/len+(z+13)*13.85/len)/11.2;return page.evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),s=Math.min(r.width,r.height);return{x:r.left+(r.width-s)/2+${u}*s,y:r.top+(r.height-s)/2+${1-v}*s}})()`);};
 const initial=a.call('state',{},p[side].token).match.setup;const other=initial.draft.findIndex((x,i)=>i>=20&&x!==initial.draft[0]);
 await clickPixel(await cell(0));await clickPixel(await cell(other));await new Promise(r=>setTimeout(r,1200));assert.equal(swapCalls,1);assert.equal(a.call('state',{},p[side].token).match.setup.draft[0],initial.draft[other]);
 await page.call('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:false});await new Promise(r=>setTimeout(r,1000));await page.screenshot('Logs/focus-landscape.png');
 await clickPixel(await cell(0));await clickPixel(await cell(other));await new Promise(r=>setTimeout(r,1200));assert.equal(swapCalls,2);assert.deepEqual(a.call('state',{},p[side].token).match.setup.draft,initial.draft);
 a.call('teacher/pause',{},'isolated-fixture-only');await new Promise(r=>setTimeout(r,1300));await page.screenshot('Logs/focus-paused.png');await clickPixel(await cell(0));await clickPixel(await cell(other));assert.equal(swapCalls,2);
 const normal=await page.evaluate("(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return{x:r.left+50,y:r.bottom-30}})()");await clickPixel(normal);await page.wait('window.historyBoardFocusActive===false');await page.screenshot('Logs/focus-normal-return.png');
 await writeFile('Logs/board-focus-result.json',JSON.stringify({touch,side,normalDefault:true,portraitSwap:true,landscapeSwap:true,pausedSwapBlocked:true,normalReturn:true,swapCalls,livePlayroom:false}));
 const exceptions = page.logs.filter(x => x.method === 'Runtime.exceptionThrown');
	await writeFile('Logs/focus-unity-result.json', JSON.stringify({
		stateReads, exceptions: exceptions.length, screenshots: 'Logs/focus-*.png', fixtureOnly: true
	}, null, 2));
	assert.equal(exceptions.length, 0);
	console.log('Actual Unity fixture rendered; screenshot ready for pixel inspection.');
}
finally {
	if (browser)
		await browser.close();
	await new Promise(r => server.close(r));
}
