import test from 'node:test';import assert from 'node:assert/strict';
import {createMatch,selectionOptions,view,legal,move} from '../server/game.mjs';
const make=()=>{const m=createMatch(['a','b']);m.phase='play';m.ready=[true,true];m.board[60]={id:'a',side:0,rank:'2'};m.board[0]={id:'b',side:1,rank:'4'};m.board[70]={id:'bomb',side:0,rank:'B'};return m;};
test('cached owner targets reuse authoritative rules, repetition history and current sequence',()=>{
 const m=make();m.history[0]=[{id:'a',from:60,to:61},{id:'a',from:61,to:60}];
 const options=selectionOptions(m,0);assert.equal(options.length,1);assert(options[0].targets.some(t=>t.to===61));
 for(let to=0;to<100;to++)assert.equal(options[0].targets.some(t=>t.to===to),legal(m,0,60,to));
 assert.equal(selectionOptions(m,0),options);move(m,0,60,50,0,'move');assert.deepEqual(selectionOptions(m,0),[]);assert(selectionOptions(m,1).every(s=>s.seq===m.seq&&s.side===1));
});
test('opponents/spectators/blocked and terminal views never receive owner target cache',()=>{
 const m=make();assert.deepEqual(view(m,1).selectionOptions,[]);assert.deepEqual(view(m,0,{spectator:true}).selectionOptions,[]);
 assert(!JSON.stringify(view(m,0).selectionOptions).includes('rank'));m.reveal={};assert.deepEqual(selectionOptions(m,0),[]);m.reveal=null;m.phase='over';assert.deepEqual(selectionOptions(m,0),[]);
});