import {createAuthority} from './engine/authority.mjs';
import {COMMANDERS} from './engine/commanders.mjs';
import {createOpponent} from './npc.mjs';
export const SOLO_KEY='history.solo.v1';
const allowed=new Set(['join','state','setup/begin','setup/next','setup/swap','setup/shuffle','setup','select','move','ack','battle/ready','emote']);
// The local simulation owns both armies; only the human's redacted view crosses this adapter.
// This is a local game, not an anti-cheat boundary against the owner of browser developer tools.
export function createSolo({storage=globalThis.sessionStorage,now=()=>performance.now(),visible=()=>!document.hidden,onStatus=()=>{},opponentFactory=createOpponent,authorityFactory=createAuthority,schedule=setInterval,cancel=clearInterval}={}){
 let saved=null;try{const raw=storage.getItem(SOLO_KEY);if(raw)saved=JSON.parse(raw);}catch{throw Error('Saved solo game could not be read. Choose New solo game to restart.');}
 if(saved&&saved.version!==1)throw Error('This saved solo game is incompatible. Choose New solo game to restart.');
 let clock=saved?.clock??0,last=now(),closed=false,bot,memory=saved?.memory??null;
 const teacherKey=saved?.teacherKey??crypto.randomUUID(),classCode='SOLO';
 if(saved?.memory) { const m=saved.snapshot?.matches?.find(m=>m.id===saved.memory.matchId); if(m){m.decisionMemory??=[null,null];m.decisionMemory[saved.memory.side]=saved.memory;} }
 const authority=authorityFactory({teacherKey,classCode,snapshot:saved?.snapshot??null,commanderPool:COMMANDERS.filter(c=>/general/i.test(c.role)),now:()=>clock});
 let humanToken=saved?.humanToken,botToken=saved?.botToken;
 const advance=()=>{const stamp=now();if(!closed&&visible())clock+=Math.max(0,Math.min(1000,stamp-last));last=stamp;};
 const save=()=>{if(!humanToken||!botToken)return;try{storage.setItem(SOLO_KEY,JSON.stringify({version:1,clock,teacherKey,humanToken,botToken,memory,snapshot:authority.exportSnapshot()}));}catch{onStatus('Solo game is running, but this browser cannot save progress.');}};
 if(!saved){humanToken=authority.call('join',{classCode}).token;botToken=authority.call('join',{classCode}).token;authority.call('teacher/start',{},teacherKey);}
 else {authority.call('state',{},humanToken);authority.call('state',{},botToken);}
 const botAuthority={call(route,body,token){if(closed)throw Error('Solo session closed');advance();const value=authority.call(route,body,token);save();return value;}};
 bot=opponentFactory(botAuthority,teacherKey,classCode,botToken,{isActive:()=>!closed&&visible(),now:()=>clock,initialMemory:memory,persist:async value=>{memory=value;save();}});
 // Finish only the computer's setup; the human sees the existing VS intro and three stages.
 const opponent=authority.call('state',{},botToken);
 if(opponent.match?.phase==='setup'&&!opponent.match.ready[opponent.match.side])authority.call('teacher/setup-npc',{a:opponent.player,matchId:opponent.match.id},teacherKey);
 const interval=schedule(()=>{if(closed)return;advance();if(visible())authority.tick();save();},250);
 save();
 return {role:'solo',code:classCode,joinCode:'Solo',request(route,body={}){
  if(closed)throw Error('Solo session closed');if(!allowed.has(route))throw Error('Action unavailable in solo play');
  advance();const value=authority.call(route,route==='join'?{classCode}:body,humanToken);save();return value;
 },close(){if(closed)return;advance();save();closed=true;cancel(interval);bot.stop();}};
}
