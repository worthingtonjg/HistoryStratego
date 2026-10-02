import http from 'node:http';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { launchBrowser } from './browser-helper.mjs';
import { createAuthority } from '../server/server.mjs';
import { army, move } from '../server/game.mjs';
const root = resolve(process.env.HISTORY_VISUAL_BUILD || 'Builds/CombatMessagesRelease');
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



m.board[60]={id:'attacker',side:0,rank:'6'};m.board[50]={id:'defender',side:1,rank:'4'};move(m,0,60,50,m.seq,'combat-fixture');
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
 const click=async(x,y)=>{const q=await page.evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),s=Math.min(r.width/1200,r.height/900);return{x:r.left+(r.width-1200*s)/2+${x}*s,y:r.top+(r.height-900*s)/2+${y}*s}})()`);await page.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...q});await new Promise(r=>setTimeout(r,100));await page.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...q});};
 const seq=m.seq,turn=m.turn;await click(955,200);await click(1040,755);await new Promise(r=>setTimeout(r,150));await page.screenshot('Logs/combat-message-menu.png');const wheel=await page.evaluate("(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),s=Math.min(r.width/1200,r.height/900);return{x:r.left+(r.width-1200*s)/2+1040*s,y:r.top+(r.height-900*s)/2+600*s}})()");await page.call('Input.dispatchMouseEvent',{type:'mouseWheel',deltaX:0,deltaY:400,...wheel});await new Promise(r=>setTimeout(r,150));await click(1040,554);
 const until=Date.now()+4000;while(emoteCalls<1&&Date.now()<until)await new Promise(r=>setTimeout(r,100));assert.equal(emoteCalls,1);await new Promise(r=>setTimeout(r,700));await page.screenshot('Logs/combat-message-header.png');
 assert.equal(m.seq,seq);assert.equal(m.turn,turn);assert.equal(ackCalls,0);assert.deepEqual(m.reveal.ack,[false,false]);assert.equal(a.call('state',{},p[0].token).match.emotes[0].text,'Greetings, General!');
 await click(1040,755);assert.equal(emoteCalls,1);
 await writeFile('Logs/combat-messages-result.json',JSON.stringify({sentDuringCombat:true,emoteCalls,ackCalls,sequenceUnchanged:m.seq===seq,turnUnchanged:m.turn===turn,cooldownMs:a.call('state',{},p[0].token).match.emoteCooldownMs}));
 const exceptions = page.logs.filter(x => x.method === 'Runtime.exceptionThrown');
	await writeFile('Logs/combat-messages-unity-result.json', JSON.stringify({
		stateReads, exceptions: exceptions.length, screenshot: 'Logs/combat-message-header.png', fixtureOnly: true
	}, null, 2));
	assert.equal(exceptions.length, 0);
	console.log('Actual Unity fixture rendered; screenshot ready for pixel inspection.');
}
finally {
	if (browser)
		await browser.close();
	await new Promise(r => server.close(r));
}
