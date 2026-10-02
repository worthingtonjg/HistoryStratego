import test from 'node:test';
import assert from 'node:assert/strict';
import {renderClassState} from '../browser/class-status.mjs';
test('round end and next active round do not retire a classroom or leave a stale banner',()=>{
 const message={textContent:'Connected to host'},next={hidden:true};
 renderClassState({phase:'ended'},message,next);assert(next.hidden);assert(!message.textContent.startsWith('Class ended'));
 next.hidden=false;message.textContent='Class ended. Ask your teacher for the next code.';
 renderClassState({phase:'active'},message,next);assert(next.hidden);assert.equal(message.textContent,'Connected to host');
 for(const phase of ['paused','waiting','ended']){next.hidden=false;renderClassState({phase},message,next);assert(next.hidden);}
});
test('only explicit retirement shows next-class action; errors do not classify a classroom',()=>{
 const message={textContent:'Teacher unavailable'},next={hidden:true};
 renderClassState({error:'Class ended in an unrelated error'},message,next);assert(next.hidden);assert.equal(message.textContent,'Teacher unavailable');
 renderClassState({phase:'ended',classRetired:true},message,next);assert(!next.hidden);assert(message.textContent.startsWith('Class ended'));
 renderClassState({error:'Temporary connection failure'},message,next);assert(!next.hidden);
});test('waiting retirement replaces Unity with the primary ended view; round end, pause and errors do not',()=>{
 const message={textContent:''},next={hidden:true},game={hidden:false,inert:false},ended={hidden:true,focus(){this.focused=true;}};
 for(const value of [{phase:'waiting'},{phase:'paused'},{phase:'ended'},{error:'Disconnected'}]){renderClassState(value,message,next,game,ended);assert.equal(game.hidden,false);assert.equal(ended.hidden,true);}
 renderClassState({phase:'ended',match:null,classRetired:true},message,next,game,ended);assert(game.hidden);assert(game.inert);assert(!ended.hidden);assert(ended.focused);
 renderClassState({error:'Disconnected'},message,next,game,ended);assert(game.hidden);assert(!ended.hidden);
});
