import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {launchBrowser} from './browser-helper.mjs';
const root=resolve(process.env.HISTORY_QA_ROOT||'Builds/PublicRepository/docs');
const mode=process.env.HISTORY_QA_MODE||'before';
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.data':'application/octet-stream','.json':'application/json','.png':'image/png'};
const server=http.createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/qa-host.html'){res.setHeader('Content-Type','text/html');res.end(`<script type="module">import {connectClassroom} from './browser/transport.mjs';import {acceptUnityTeacherGate} from './browser/teacher-access.mjs';try{window.host=await connectClassroom({role:'teacher',teacherAccess:acceptUnityTeacherGate(),allowHidden:true});window.ready=true}catch(e){window.failure=e.message}</script>`);return;}
 const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!path.startsWith(root+'\\'))throw Error('path');res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));
}catch(e){res.statusCode=404;res.end('Not found');}}).listen(0,'127.0.0.1');
await new Promise(r=>server.on('listening',r));
let browser,host;
try{
 browser=await launchBrowser();const base='http://127.0.0.1:'+server.address().port;
 host=await browser.page(base+'/qa-host.html',{initScript:"Object.defineProperty(document,'hidden',{get:()=>false});"});
 await host.wait('window.ready||window.failure',45000);const failure=await host.evaluate('window.failure');if(failure)throw Error('Live Playroom: '+failure);
 const code=await host.evaluate('host.joinCode');
 const player=await browser.page(base+'/index.html?qa=1',{width:1600,height:900});
 await player.evaluate(`document.querySelector('#join-code').value=${JSON.stringify(code)};document.querySelector('#join').click()`);
 await player.wait('!!window.historyClassroom&&!!window.unityInstance',120000);
 await host.wait('host.authority.students.size===1');
 if(mode==='before') await host.evaluate("host.addComputer()");
 else await host.evaluate("window.other=host.authority.call('join',{classCode:host.code})");
 await host.evaluate("host.request('teacher/start')");
 if(mode!=='before') await host.evaluate("(()=>{const m=[...host.authority.matches.values()][0];host.authority.call('setup/begin',{matchId:m.id},other.token);const v=host.authority.call('state',{},other.token);host.authority.call('setup',{matchId:m.id,revision:v.match.setup.revision},other.token);})()");
 await player.evaluate(`window.qaCalls=[];const original=historyClassroom.request.bind(historyClassroom);historyClassroom.request=async(route,body,token)=>{qaCalls.push({route,at:performance.now()});if(route==='state'){qaPolling=true;window.qaPollStarted=performance.now();}const result=await original(route,body,token);if(route==='state'){window.qaState=result;await new Promise(r=>setTimeout(r,700));qaPolling=false;window.qaDelivered=result;}return result;};window.qaPolling=false;`);
 await player.wait('window.qaDelivered?.match?.setup&&!qaDelivered.match.setup.started',30000);await new Promise(r=>setTimeout(r,800));
 const click=async(x,y)=>{const p=await player.evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),s=Math.min(r.width/1200,r.height/900);return{x:r.left+(r.width-1200*s)/2+${x}*s,y:r.top+(r.height-900*s)/2+${y}*s}})()`);await player.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await new Promise(r=>setTimeout(r,100));await player.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});};
 await player.wait('qaPolling');await player.screenshot('Logs/setup-poll-'+mode+'.png');await click(600,794);
 await new Promise(r=>setTimeout(r,2000));
 const result=await player.evaluate('({started:qaState.match.setup.started,beginCalls:qaCalls.filter(x=>x.route==="setup/begin").length})');
 if(mode==='before'){assert.equal(result.started,false);assert.equal(result.beginCalls,0);console.log('REPRODUCED: live Playroom polling disables Start and drops its click.');}
 else {
  assert.equal(result.started,true);assert.equal(result.beginCalls,1);
  const poll=()=>player.wait('qaPolling&&performance.now()-qaPollStarted<180',15000);
  const homePoint=k=>{const n=60+k,x=n%10-4.5,z=4.5-Math.floor(n/10)-.11,y=.645,len=Math.hypot(13.85,13),u=.5+x/(8*(1400/899)),v=.5+((y-14)*13/len+(z+13)*13.85/len)/8;return [25+u*865,178+(1-v)*555];};
  const initial=await player.evaluate('({draft:qaState.match.setup.draft,revision:qaState.match.setup.revision})');
  const second=initial.draft.findIndex(x=>x!==initial.draft[0]);assert(second>0);
  await poll();await click(...homePoint(0));await click(...homePoint(second));
  await player.wait('qaCalls.filter(x=>x.route==="setup/swap").length===1');
  await player.wait(`qaState.match.setup.revision===${initial.revision+1}`);
  const swapped=await player.evaluate('qaState.match.setup.draft');assert.equal(swapped[0],initial.draft[second]);assert.equal(swapped[second],initial.draft[0]);
  await player.wait('!qaPolling');await poll();await click(1040,857);
  await player.wait('qaCalls.filter(x=>x.route==="setup/shuffle").length===1');
  await player.wait(`qaState.match.setup.revision===${initial.revision+2}`);
  await player.wait('!qaPolling');await poll();await player.screenshot('Logs/setup-controls-after.png');await click(1040,810);
  await player.wait('qaState.match.phase==="play"');
  const side=await player.evaluate('qaState.match.side');
  await host.evaluate(`(()=>{const m=[...host.authority.matches.values()][0];m.turn=${1-side};m.timedTurns=false;})()`);
  await player.wait('qaState.match.turn!==qaState.match.side');await new Promise(r=>setTimeout(r,2300));
  await poll();await click(1040,755);await new Promise(r=>setTimeout(r,200));await player.screenshot('Logs/message-menu-poll-after.png');
  await poll();await click(1040,554);await player.wait('qaCalls.filter(x=>x.route==="emote").length===1');
  await player.wait('qaState.match.emotes?.length>0');await new Promise(r=>setTimeout(r,850));await player.screenshot('Logs/message-panel-sender-after.png');
  assert.equal(await player.evaluate('qaState.match.turn!==qaState.match.side'),true);
  await host.evaluate("(()=>{const m=[...host.authority.matches.values()][0];host.authority.call('emote',{matchId:m.id,emoteId:'well_played'},other.token)})()");
  await player.wait('qaState.match.emotes?.some(x=>x.text==="Well played!")');await new Promise(r=>setTimeout(r,850));await player.screenshot('Logs/message-panel-opponent-after.png');
  await new Promise(r=>setTimeout(r,4500));await player.screenshot('Logs/message-panel-expired-after.png');
  result.swap=true;result.shuffle=true;result.lock=true;result.offTurnMessage=true;result.opponentMessage=true;
  result.actionCounts=await player.evaluate('Object.fromEntries(["setup/begin","setup/swap","setup/shuffle","setup","emote"].map(r=>[r,qaCalls.filter(x=>x.route===r).length]))');
  await player.call('Emulation.setDeviceMetricsOverride',{width:420,height:700,deviceScaleFactor:1,mobile:false});
  const spacing=await player.evaluate(`(()=>{const c=document.querySelector('#public-code').getBoundingClientRect(),s=document.querySelector('#connection-status').getBoundingClientRect(),b=document.querySelector('#classroom-bar');return{clear:s.top>c.bottom||s.left>=c.right+8,overflow:b.scrollWidth>b.clientWidth}})()`);assert(spacing.clear&&!spacing.overflow);result.toolbarWrap=true;
  console.log('PASS live Playroom: queued intro/start/shuffle/swap once each, off-turn message, opponent message and responsive toolbar.');
 }
 await writeFile('Logs/setup-poll-'+mode+'.json',JSON.stringify(result,null,2));
}finally{if(host){try{await host.evaluate('host?.retire()')}catch{}}if(browser)await browser.close();await new Promise(r=>server.close(r));}
