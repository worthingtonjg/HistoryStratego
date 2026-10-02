import http from 'node:http';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { launchBrowser } from './browser-helper.mjs';
import { createAuthority } from '../server/server.mjs';
import { army, move } from '../server/game.mjs';
const root = resolve(process.env.HISTORY_VISUAL_BUILD || 'Builds/ResponsiveInputFinal');
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
m.board=Array(100).fill(null);m.board[60]={id:'a',side:0,rank:'6'};m.board[61]={id:'b',side:0,rank:'4'};m.board[50]={id:'c',side:1,rank:'4'};m.board[0]={id:'d',side:1,rank:'2'};m.board[99]={id:'f0',side:0,rank:'F'};m.board[9]={id:'f1',side:1,rank:'F'};
let stateReads=0,reading=false,slow=false,moveCalls=0,ackCalls=0;
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
			if(route==='move')moveCalls++;if(route==='ack')ackCalls++;
			const result = a.call(route, JSON.parse(text || '{}'), (req.headers.authorization || '').replace('Bearer ', ''));
			if (route === 'state')
				stateReads++;
			if(slow&&route==='state'){reading=true;await new Promise(r=>setTimeout(r,1400));reading=false;}if(slow&&route==='select')await new Promise(r=>setTimeout(r,600));
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
		width: 1600, height: 900, initScript: `sessionStorage.setItem('studentToken',${JSON.stringify(p[0].token)});window.historyPresenceStatus=()=> 'Isolated visual fixture';`
	});
	await page.wait('!!window.unityInstance', 120000);
	const end = Date.now() + 20000;
	while (stateReads < 2 && Date.now() < end)
		await new Promise(r => setTimeout(r, 300));
	assert(stateReads >= 2, 'Unity did not poll fixture state');
	await new Promise(r => setTimeout(r, 1800));
 const point=n=>{const x=n%10-4.5,z=4.5-Math.floor(n/10)-.11,y=.645,len=Math.hypot(13.85,13),u=.5+x/(8*(1400/899)),v=.5+((y-14)*13/len+(z+13)*13.85/len)/8;return[25+u*865,178+(1-v)*555];};
 const click=async(x,y)=>{const q=await page.evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),s=Math.min(r.width/1200,r.height/900);return{x:r.left+(r.width-1200*s)/2+${x}*s,y:r.top+(r.height-900*s)/2+${y}*s}})()`);await page.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...q});await new Promise(r=>setTimeout(r,80));await page.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...q});};
 slow=true;const until=Date.now()+5000;while(!reading&&Date.now()<until)await new Promise(r=>setTimeout(r,20));assert(reading);
 const clickAt=Date.now();await click(...point(61));await page.screenshot('Logs/selection-immediate.png');
 const selection=page.logs.find(e=>e.method==='Runtime.consoleAPICalled'&&e.params.args.some(a=>String(a.value).includes('SELECTION_PREVIEW')));assert(selection);const selectionLatencyMs=selection.params.timestamp-clickAt;assert(selectionLatencyMs<250);
 await click(...point(51));await click(...point(51));
 await new Promise(r=>setTimeout(r,2300));assert.equal(moveCalls,1);assert.equal(m.board[51]?.id,'b');assert.equal(m.board[61],null);slow=false;
 // Isolated fixture: open a genuine combat after setting the next test turn.
 m.turn=0;a.call('emote',{matchId:m.id,emoteId:'well_played'},p[0].token);move(m,0,60,50,m.seq,'fixture-combat');
 const readsBefore=stateReads;await page.call('Page.reload',{});const loaded=Date.now()+120000;while(stateReads<readsBefore+3&&Date.now()<loaded)await new Promise(r=>setTimeout(r,100));assert(stateReads>=readsBefore+3);
 await new Promise(r=>setTimeout(r,700));await page.screenshot('Logs/board-cutscene-message.png');
 await click(955,200);await page.screenshot('Logs/board-cutscene-sidebar.png');assert.equal(ackCalls,0);assert.equal(m.reveal.ack[0],false);
 await writeFile('Logs/responsive-gameplay-result.json',JSON.stringify({selectionLatencyMs,injectedStateDelayMs:1400,moveCalls,repeatedDestinationClicks:2,sidebarAcknowledged:false}));
 console.log('Selection preview latency ms:',selectionLatencyMs,'; one move for repeated destination clicks; sidebar did not acknowledge combat.');
 const exceptions = page.logs.filter(x => x.method === 'Runtime.exceptionThrown');
	await writeFile('Logs/responsive-gameplay-unity-result.json', JSON.stringify({
		stateReads, exceptions: exceptions.length, screenshot: 'Logs/board-cutscene-message.png', fixtureOnly: true
	}, null, 2));
	assert.equal(exceptions.length, 0);
	console.log('Actual Unity fixture rendered; screenshot ready for pixel inspection.');
}
finally {
	if (browser)
		await browser.close();
	await new Promise(r => server.close(r));
}
