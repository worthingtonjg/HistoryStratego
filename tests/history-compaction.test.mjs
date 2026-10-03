import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,move,view,compactHistory,combatEvents,acknowledge} from '../server/game.mjs';
import {createAuthority} from '../browser/engine/authority.mjs';
import {planDemoMoves as plan} from '../tools/demo-policy.mjs';
import {tickTurn,initTurn} from '../server/turn-clock.mjs';
const serialize=m=>({...m,requests:[...m.requests]});
function longMatch(count=1200){
 const m=createMatch(['a','b']);m.phase='play';m.ready=[true,true];
 for(const [at,side,rank]of[[60,0,'5'],[39,1,'4'],[4,0,'3'],[95,1,'3'],[20,1,'B'],[10,1,'6'],[99,0,'F'],[0,1,'F']])m.board[at]={id:'p'+at,side,rank};
 m.events=[{kind:'combat',seq:1,side:0,from:30,to:20,attacker:'2',defender:'B',outcome:-1,ack:[true,true],released:[false,false]}, {kind:'combat',seq:2,side:0,from:11,to:10,attacker:'1',defender:'6',outcome:-1,ack:[true,true],released:[false,false]}, {kind:'combat',seq:3,side:0,from:14,to:4,attacker:'3',defender:'B',outcome:1,ack:[true,true],released:[false,false]}, {kind:'combat',seq:4,side:1,from:85,to:95,attacker:'3',defender:'B',outcome:1,ack:[true,true],released:[false,false]}, {kind:'combat',seq:5,side:0,from:61,to:60,attacker:'5',defender:'1',outcome:1,ack:[true,true],released:[false,false]}];m.seq=5;
 const full=[...m.events],receipts=[];
 for(let n=0;n<count;n++){const side=n%2,k=Math.floor(n/2),a=side===0?60:39,b=side===0?70:29,seq=m.seq;move(m,side,k%2?b:a,k%2?a:b,seq,'long-'+n);full.push(structuredClone(m.events.find(e=>e.seq===m.seq)));receipts.push([side+':long-'+n,JSON.stringify([k%2?b:a,k%2?a:b,seq])]);}
 return{m,full,receipts};
}
test('1200 moves retain learned ranks, both hunters, Spy death, recent paths and bounded payload',()=>{
 const{m}=longMatch();assert.equal(m.events.length,20);assert.equal(m.requests.size,128);assert.equal(m.seq,1205);
 for(const side of [0,1]){const v=view(m,side),memory=v.decisionMemory;assert.equal(Object.keys(memory.hunters).length,1);assert.equal(memory.recentMoves.length,6);assert.equal(memory.enemySpyEliminated,true);assert.equal(memory.lastSeq,m.seq);assert(v.board.filter(p=>p?.side===1-side).every(p=>p.rank==='?'));if(side===0){assert.equal(memory.bombs[20].removed,false);assert(Object.values(memory.knowledge.pieces).some(p=>p.square===10&&p.rank==='6'));}
 const expected=plan(v,memory),restored=plan(JSON.parse(JSON.stringify(v)));assert.deepEqual(restored,expected);
 }
 assert(JSON.stringify(serialize(m)).length<22000);
 const seq=m.seq;move(m,1,29,39,1204,'long-1199');assert.equal(m.seq,seq);assert.throws(()=>move(m,0,60,70,5,'long-0'),/Stale/);assert.equal(m.seq,seq);
});
test('legacy full journal migration preserves exact next decisions for both factions',()=>{
 const{m,full,receipts}=longMatch(100);m.events=full;delete m.decisionMemory;delete m.combats;delete m.historyVersion;m.requests=new Map(receipts);
 const expected=[0,1].map(side=>plan(view(m,side,{skipHistory:true})));
 compactHistory(m);
 for(const side of [0,1])assert.deepEqual(plan(view(m,side)),expected[side]);
 assert.equal(m.events.length,20);assert.equal(combatEvents(m).length,5);
});
test('older unread combat remains reviewable and relinked after JSON restore outside the visible tail',()=>{
 const{m}=longMatch(40),e=combatEvents(m)[0];e.ack=[false,true];m.reveal=e;
 const a=createAuthority({teacherKey:'fixture',classCode:'TEST',timedSetup:false,timedTurns:false,snapshot:{phase:'active',order:['a','b'],students:[{id:'a',token:'a',name:'A'},{id:'b',token:'b',name:'B'}],matches:[JSON.parse(JSON.stringify(serialize(m)))]}});
 const v=a.call('state',{},'a').match;assert.equal(v.events.length,20);assert.equal(v.battle.seq,1);assert.equal(v.blocked,true);assert.throws(()=>a.call('move',{from:60,to:70,seq:m.seq,requestId:'blocked'},'a'),/pending combat/);
 a.call('ack',{matchId:m.id,seq:1},'a');assert.equal(a.call('state',{},'a').match.battle,null);assert.equal(a.exportSnapshot().matches[0].combats[0].ack[0],true);
});
test('stored controller assignment and timeout memory survive snapshot and compaction',()=>{
 const{m}=longMatch(40);const memory=plan(view(m,0)).memory;m.decisionMemory[0]=memory;m.timeoutMemory=[structuredClone(memory),null];const restored=JSON.parse(JSON.stringify(serialize(m)));restored.requests=new Map(restored.requests);compactHistory(restored);assert.deepEqual(plan(view(restored,0)),plan(view(m,0),memory));assert.deepEqual(restored.timeoutMemory[0],memory);
});
const pools=p=>[...p.candidates,...p.fallback,...p.emergency];
function safety(side,{guard=4,miner=50,bomb=20,hunter=false,enemyAt=41}={}){
 const flip=i=>side?99-i:i,m={id:'safe'+side,seq:2,side,turn:side,board:Array(100).fill(null),events:[]};
 m.board[flip(miner)]={side,rank:'3'};m.board[flip(bomb)]={side:1-side,rank:'?'};m.board[flip(enemyAt)]={side:1-side,rank:'?'};
 m.events=[{kind:'combat',seq:1,side,from:flip(30),to:flip(bomb),attacker:'2',defender:'B',outcome:-1},{kind:'combat',seq:2,side,from:flip(enemyAt+1),to:flip(enemyAt),attacker:'2',defender:String(guard),outcome:-1}];
 let memory=plan(m).memory;if(hunter)memory.hunters={[Object.keys(memory.miners)[0]]:true};return{m,flip,memory};
}
for(const side of [0,1])test('Miner hard safety side '+side+': approach, detour, disarm and earned hunt',()=>{
 let{m,flip,memory}=safety(side);let p=plan(m,memory);assert(!pools(p).some(c=>c.from===flip(50)&&c.to===flip(40)));assert(pools(p).some(c=>c.from===flip(50)&&c.to===flip(60)));
 ({m,flip,memory}=safety(side,{miner:30,enemyAt:21}));p=plan(m,memory);assert(p.candidates.some(c=>c.from===flip(30)&&c.to===flip(20)),'dangerous actual disarm allowed');
 ({m,flip,memory}=safety(side,{miner:14,bomb:4,enemyAt:6,hunter:true}));m.board[flip(4)]=null;m.board[flip(14)]=null;m.board[flip(4)]={side,rank:'3'};memory.miners[Object.keys(memory.hunters)[0]]=flip(4);p=plan(m,memory);assert(pools(p).some(c=>c.from===flip(4)&&c.to===flip(5)),'earned rear-row hunting risk allowed');
 ({m,flip,memory}=safety(side,{guard:2}));p=plan(m,memory);assert(pools(p).some(c=>c.to===flip(40)),'known Scout cannot kill defending Miner');
});
test('old reviewed archives retain compact results; all unresolved battles survive',()=>{
 const archives=Array.from({length:45},(_,i)=>{const m=createMatch(['a','b']);m.id='old'+i;m.phase='over';m.archived=true;m.roundEnded=true;return serialize(m);});archives[0].events=[{kind:'combat',seq:1,side:0,from:60,to:50,attacker:'2',defender:'B',outcome:-1,ack:[false,true],released:[true,false]}];archives[0].seq=1;
 const a=createAuthority({teacherKey:'fixture',snapshot:{phase:'waiting',order:[],students:[],matches:[],archives}});a.call('teacher/state',{},'fixture');const saved=a.exportSnapshot();assert.equal(saved.archives.length,45);assert(saved.archives.some(m=>m.id==='old0'));assert(saved.archives.find(m=>m.id==='old1').archiveSummary);assert.equal(saved.archives.filter(m=>m.archiveSummary).length,4);
});
for(const side of [0,1])test('Miner safety side '+side+' survives timeout fallback and routes around known threats',()=>{
 const f=safety(side),m=createMatch(['a','b']);Object.assign(m,{id:f.m.id,side,turn:side,phase:'play',seq:f.m.seq,board:structuredClone(f.m.board),events:f.m.events.map(e=>({...e,ack:[true,true],released:[false,false]})),ready:[true,true]});m.board[f.flip(60)]={side,rank:'B',id:'block'};m.board[f.flip(50)].id='miner';initTurn(m);for(const now of [0,2000,32000,35000])tickTurn(m,'active',now,true);assert.equal(m.seq,2);assert.equal(m.turnClock.remaining,30000);assert.equal(m.board[f.flip(50)].rank,'3');
 const r=safety(side,{miner:60,enemyAt:31});let memory=r.memory,arrived=false;
 for(let i=0;i<80;i++) {const p=plan(r.m,memory);memory=p.memory;const c=p.candidates[0];assert(c);const isBomb=c.to===r.flip(20);if(!isBomb)assert.notEqual(Math.abs(c.to%10-r.flip(31)%10)+Math.abs(Math.floor(c.to/10)-Math.floor(r.flip(31)/10)),1);const pawn=r.m.board[c.from];r.m.board[c.from]=null;r.m.board[c.to]=pawn;r.m.events.push({kind:isBomb?'combat':'move',side,seq:++r.m.seq,from:c.from,to:c.to,...(isBomb?{attacker:'3',defender:'B',outcome:1}:{})});if(isBomb){arrived=true;break;}}
 assert(arrived,'safe detour reaches Bomb');
});
test('same-sequence legacy timeout memory is adopted before trimming and seeds old quiet-move memory',()=>{
 const{m,full,receipts}=longMatch(40);m.events=full;m.requests=new Map(receipts);delete m.decisionMemory;
 for(let i=0;i<22;i++)m.events.push({kind:'combat',side:0,seq:++m.seq,from:81,to:80,attacker:'2',defender:'4',outcome:0,ack:[true,true],released:[false,false]});
 m.timeoutMemory=[0,1].map(side=>plan(view(m,side,{skipHistory:true})).memory);
 const expected=m.timeoutMemory.map(x=>structuredClone(x));for(const memory of m.timeoutMemory)delete memory.recentMoves;
 compactHistory(m);assert.equal(m.events.length,20);
 for(const side of [0,1]){assert(m.decisionMemory[side]);assert.deepEqual(m.decisionMemory[side].recentMoves,expected[side].recentMoves);assert.equal(m.decisionMemory[side].recentMoves.length,6);assert.deepEqual(m.decisionMemory[side].hunters,expected[side].hunters);}
});
