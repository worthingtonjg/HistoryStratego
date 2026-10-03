import http from 'node:http';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { launchBrowser } from './browser-helper.mjs';
import { createAuthority } from '../server/server.mjs';
import { army, move } from '../server/game.mjs';
const root = resolve(process.env.HISTORY_VISUAL_BUILD || 'Builds/MovePreviewRelease');
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
m.board.fill(null);m.turn=side;m.board[60]={id:"attacker",side,rank:"6"};m.board[50]={id:"defender",side:1-side,rank:"4"};m.board[99]={id:"spare-a",side,rank:"2"};m.board[0]={id:"spare-b",side:1-side,rank:"2"};move(m,side,60,50,m.seq,"upright-fixture");a.call("teacher/pause",{},"isolated-fixture-only");
let ackCalls=0;let stateReads = 0, swapCalls = 0, slow=false, reading=false, rejectNext=false;
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
			const route = pathname.slice(5);if(route==='ack')ackCalls++;
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

 const prefix='board-attack';
 const opponent=await browser.page('http://127.0.0.1:'+server.address().port+'/?qa=1',{width:1600,height:900,initScript:`sessionStorage.setItem('studentToken',${JSON.stringify(p[1-side].token)});window.historyPresenceStatus=()=> 'Isolated visual fixture';`});
 await opponent.wait('!!window.unityInstance',120000);await new Promise(r=>setTimeout(r,4000));
 await page.screenshot(`Logs/upright-combat-side${side}-normal.png`);
 assert.deepEqual(m.reveal.ack,[false,false]);
 await page.call('Page.reload');await page.wait('!!window.unityInstance',120000);await new Promise(r=>setTimeout(r,3000));assert(page.logs.some(e=>e.method==='Runtime.consoleAPICalled'&&e.params.args.some(a=>String(a.value).includes('BOARD_ATTACK_HELD'))));
 const click=async(target)=>{const q=await target.evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),s=Math.min(r.width/1200,r.height/900);return{x:r.left+(r.width-1200*s)/2+450*s,y:r.top+(r.height-900*s)/2+500*s}})()`);await target.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...q});await new Promise(r=>setTimeout(r,100));await target.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...q});};
 const wait=async(fn)=>{const until=Date.now()+12000;while(!fn()&&Date.now()<until)await new Promise(r=>setTimeout(r,200));assert(fn());};
 await click(page);await new Promise(r=>setTimeout(r,350));assert.deepEqual(m.reveal.ack,[false,false]);a.call("teacher/resume",{},"isolated-fixture-only");await new Promise(r=>setTimeout(r,1300));await page.screenshot(`Logs/upright-combat-side${side}-normal.png`);await click(page);await wait(()=>m.reveal?.ack[side]);assert.equal(m.reveal.ack[1-side],false);await click(opponent);await wait(()=>!m.reveal);assert.equal(ackCalls,2);await new Promise(r=>setTimeout(r,2200));for(const tag of ['BOARD_ATTACK_SETTLING','BOARD_ATTACK_SETTLED'])assert(page.logs.some(e=>e.method==='Runtime.consoleAPICalled'&&e.params.args.some(a=>String(a.value).includes(tag))),tag);await page.screenshot('Logs/board-attack-resolved.png');
 assert.equal(a.call('state',{},p[side].token).phase,'active');
 await writeFile(`Logs/board-attack-ack-side${side}.json`,JSON.stringify({side,ownAckOnly:true,bothRequired:true,explicitAckCalls:ackCalls,pauseBlocksInput:true,resumeRequired:true,livePlayroom:false}));

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
