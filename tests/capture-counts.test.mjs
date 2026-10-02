import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,army,setup,move,captureTotals} from '../server/game.mjs';
import {createAuthority} from '../browser/engine/authority.mjs';
const piece=(side,rank,id)=>({side,rank,id});
for (const side of [0,1]) for(const [attacker,defender,expected] of [['6','4',[1,0]],['4','6',[0,1]],['4','4',[1,1]],['4','B',[0,1]],['3','B',[1,0]],['2','F',[1,0]]]) {
 test(`capture totals side ${side}: ${attacker} versus ${defender}`,()=>{
  const m=createMatch(['a','b']);m.phase='play';m.turn=side;m.ready=[true,true];
  m.board[60]=piece(side,attacker,'attacker');m.board[50]=piece(1-side,defender,'defender');m.board[0]=piece(1-side,'2','reserve');
  move(m,side,60,50,0,'once');const totals=side===0?expected:[expected[1],expected[0]];
  assert.deepEqual(captureTotals(m),totals);
  move(m,side,60,50,0,'once');assert.deepEqual(captureTotals(m),totals);
  m.events=[];assert.deepEqual(captureTotals(m),totals,'independent of journal');
 });
}
test('setup and normal moves have zero captures; legacy full-army checkpoints recover exact totals',()=>{
 const m=createMatch(['a','b']);assert.deepEqual(captureTotals(m),[0,0]);setup(m,0,army());delete m.captures;assert.deepEqual(captureTotals(m),[0,0]);
 setup(m,1,army());delete m.board[0];delete m.board[1];delete m.board[60];assert.deepEqual(captureTotals(m),[2,1]);
 const n=createMatch(['a','b']);n.phase='play';n.board[60]=piece(0,'4','a');n.board[0]=piece(1,'2','b');move(n,0,60,50,0,'walk');assert.deepEqual(captureTotals(n),[0,0]);
});
test('teacher summary persists totals across checkpoint recovery without exposing ranks',()=>{
 const key='fixture-only';const a=createAuthority({teacherKey:key,classCode:'QA',timedSetup:false,timedTurns:false});
 const p=[a.call('join',{classCode:'QA'}),a.call('join',{classCode:'QA'})];a.call('teacher/start',{},key);
 for(const x of p)a.call('setup',{ranks:army()},x.token);
 const m=[...a.matches.values()][0];m.captures=[7,3];m.events=[];
 const restored=createAuthority({teacherKey:key,classCode:'QA',snapshot:a.exportSnapshot(),timedSetup:false,timedTurns:false});
 const summary=restored.call('teacher/state',{},key).matches[0];assert.deepEqual(summary.captures,[7,3]);assert(!('board' in summary));assert(!('draft' in summary));
});