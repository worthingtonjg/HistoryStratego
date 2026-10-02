import http from 'node:http';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {launchBrowser} from './browser-helper.mjs';
import {createAuthority} from '../server/server.mjs';
import {army} from '../server/game.mjs';
const root=resolve('Builds/ToggleDotsFinal');
const a=createAuthority({teacherKey:'isolated-fixture-only',classCode:'QA',now:()=>100000,timedSetup:false,timedTurns:false});
const p=[a.call('join',{classCode:'QA'}),a.call('join',{classCode:'QA'})];
a.call('teacher/start',{},'isolated-fixture-only');
for(const player of p)a.call('setup',{ranks:army()},player.token);
const m=[...a.matches.values()][0];
m.playerNames=['J. E. B. Stuart','Webb'];
m.commanders[0].fullName='James Ewell Brown Stuart';m.commanders[1].fullName='Alexander Stewart Webb';
let stateReads=0;
const mime={'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm','.data':'application/octet-stream','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname.startsWith('/api/')){let text='';for await(const c of req)text+=c;const route=pathname.slice(5);const result=a.call(route,JSON.parse(text||'{}'),(req.headers.authorization||'').replace('Bearer ',''));if(route==='state')stateReads++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;}
 const file=pathname==='/facts.json'?resolve('web/facts.json'):resolve(root,pathname==='/'?'index.html':'.'+pathname);
 if(file!==resolve('web/facts.json')&&!file.startsWith(root+'\\'))throw Error('path');
 res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch(e){res.statusCode=404;res.end('Fixture request unavailable');}}).listen(0,'127.0.0.1');
await new Promise(r=>server.on('listening',r));
let browser;
try{
 browser=await launchBrowser();
 const page=await browser.page('http://127.0.0.1:'+server.address().port+'/?qa=1',{width:1600,height:900,initScript:`sessionStorage.setItem('studentToken',${JSON.stringify(p[0].token)});window.historyPresenceStatus=()=> 'Isolated visual fixture';`});
 await page.wait('!!window.unityInstance',120000);
 const end=Date.now()+20000;while(stateReads<2&&Date.now()<end)await new Promise(r=>setTimeout(r,300));
 assert(stateReads>=2,'Unity did not poll fixture state');
 await new Promise(r=>setTimeout(r,1800));
 await page.screenshot('Logs/ellipsis-unity.png');
 const exceptions=page.logs.filter(x=>x.method==='Runtime.exceptionThrown');
 await writeFile('Logs/ellipsis-unity-result.json',JSON.stringify({stateReads,exceptions:exceptions.length,screenshot:'Logs/ellipsis-unity.png',fixtureOnly:true},null,2));
 assert.equal(exceptions.length,0);console.log('Actual Unity fixture rendered; screenshot ready for pixel inspection.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
