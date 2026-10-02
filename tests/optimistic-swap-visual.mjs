import http from 'node:http';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { launchBrowser } from './browser-helper.mjs';
import { createAuthority } from '../server/server.mjs';
import { army } from '../server/game.mjs';
const root = resolve(process.env.HISTORY_VISUAL_BUILD || 'Builds/ResponsiveInputFinal');
const a = createAuthority({
	teacherKey: 'isolated-fixture-only', classCode: 'QA', now: () => 100000, timedSetup: true, timedTurns: false
});
const p = [a.call('join', {
	classCode: 'QA'
}), a.call('join', {
	classCode: 'QA'
})];
a.call('teacher/start', {}, 'isolated-fixture-only');
a.call('setup/begin', {matchId:[...a.matches.keys()][0]}, p[0].token);
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
		width: 1600, height: 900, initScript: `sessionStorage.setItem('studentToken',${JSON.stringify(p[0].token)});window.historyPresenceStatus=()=> 'Isolated visual fixture';`
	});
	await page.wait('!!window.unityInstance', 120000);
	const end = Date.now() + 20000;
	while (stateReads < 2 && Date.now() < end)
		await new Promise(r => setTimeout(r, 300));
	assert(stateReads >= 2, 'Unity did not poll fixture state');
	await new Promise(r => setTimeout(r, 1800));
	const initial=a.call('state',{},p[0].token).match.setup;
	const other=initial.draft.findIndex((x,i)=>i>=20&&x!==initial.draft[0]);assert(other>=20);
	const homePoint=k=>{const n=60+k,x=n%10-4.5,z=4.5-Math.floor(n/10)-.11,y=.645,len=Math.hypot(13.85,13),u=.5+x/(8*(1400/899)),v=.5+((y-14)*13/len+(z+13)*13.85/len)/8;return [25+u*865,178+(1-v)*555];};
	const click=async(x,y)=>{const q=await page.evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),s=Math.min(r.width/1200,r.height/900);return{x:r.left+(r.width-1200*s)/2+${x}*s,y:r.top+(r.height-900*s)/2+${y}*s}})()`);await page.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...q});await new Promise(r=>setTimeout(r,75));await page.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...q});};
	await page.screenshot('Logs/optimistic-before.png');slow=true;const until=Date.now()+5000;while(!reading&&Date.now()<until)await new Promise(r=>setTimeout(r,20));assert(reading);await click(...homePoint(0));const secondClickAt=Date.now();await click(...homePoint(other));
	await page.screenshot('Logs/optimistic-moving.png');const beforeAuthority=swapCalls;assert.equal(beforeAuthority,0,'preview must start before queued request reaches authority');await new Promise(r=>setTimeout(r,400));await page.screenshot('Logs/optimistic-awaiting.png');
	await new Promise(r=>setTimeout(r,2300));await page.screenshot('Logs/optimistic-confirmed.png');
	assert.equal(swapCalls,1);const result=a.call('state',{},p[0].token).match.setup;
	assert.equal(result.revision,initial.revision+1);assert.equal(result.draft[0],initial.draft[other]);assert.equal(result.draft[other],initial.draft[0]);
	const preview=page.logs.find(e=>e.method==='Runtime.consoleAPICalled'&&e.params.args.some(a=>String(a.value).includes('SETUP_SWAP_PREVIEW')));assert(preview);const previewLatencyMs=preview.params.timestamp-secondClickAt;assert(previewLatencyMs<250);await writeFile('Logs/optimistic-swap-result.json',JSON.stringify({swapCalls,from:0,to:other,confirmed:true,previewBeforeAuthority:beforeAuthority===0,previewLatencyMs,injectedStateDelayMs:1400,injectedSwapDelayMs:700}));console.log('Preview latency ms:',previewLatencyMs);
		 slow=false;rejectNext=true;const stable=a.call('state',{},p[0].token).match.setup;await click(...homePoint(0));await click(...homePoint(other));await page.screenshot('Logs/optimistic-rejected-preview.png');await new Promise(r=>setTimeout(r,1800));await page.screenshot('Logs/optimistic-rollback.png');
 const rolled=a.call('state',{},p[0].token).match.setup;assert.equal(rolled.revision,stable.revision);assert.deepEqual(rolled.draft,stable.draft);assert.equal(rejectNext,false);console.log('Rejected swap rolled back without changing authority revision.');
 const exceptions = page.logs.filter(x => x.method === 'Runtime.exceptionThrown');
	await writeFile('Logs/optimistic-unity-result.json', JSON.stringify({
		stateReads, exceptions: exceptions.length, screenshots: 'Logs/swap-*.png', fixtureOnly: true
	}, null, 2));
	assert.equal(exceptions.length, 0);
	console.log('Actual Unity fixture rendered; screenshot ready for pixel inspection.');
}
finally {
	if (browser)
		await browser.close();
	await new Promise(r => server.close(r));
}
