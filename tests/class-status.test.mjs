import test from 'node:test';
import assert from 'node:assert/strict';
import {renderClassState} from '../browser/class-status.mjs';
test('round end and next active round do not retire a classroom or leave a stale banner',()=>{
 const message={textContent:'Connected to teacher'},next={hidden:true};
 renderClassState({phase:'ended'},message,next);assert(next.hidden);assert(!message.textContent.startsWith('Class ended'));
 next.hidden=false;message.textContent='Class ended. Ask your teacher for the next code.';
 renderClassState({phase:'active'},message,next);assert(next.hidden);assert.equal(message.textContent,'Connected to teacher');
 for(const phase of ['paused','waiting','ended']){next.hidden=false;renderClassState({phase},message,next);assert(next.hidden);}
});
test('only explicit retirement shows next-class action; errors do not classify a classroom',()=>{
 const message={textContent:'Teacher unavailable'},next={hidden:true};
 renderClassState({error:'Class ended in an unrelated error'},message,next);assert(next.hidden);assert.equal(message.textContent,'Teacher unavailable');
 renderClassState({phase:'ended',classRetired:true},message,next);assert(!next.hidden);assert(message.textContent.startsWith('Class ended'));
 renderClassState({error:'Temporary connection failure'},message,next);assert(!next.hidden);
});