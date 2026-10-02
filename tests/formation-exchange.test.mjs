import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
test('confirmed formation exchange rejects stale, unrelated, invalid and partial snapshots', () => {
 const d=mkdtempSync(join(tmpdir(),'history-exchange-')), exe=join(d,'exchange.exe');
 try {
 execFileSync(join(process.env.WINDIR,'Microsoft.NET','Framework64','v4.0.30319','csc.exe'),['/nologo','/out:'+exe,resolve('Assets/Scripts/FormationExchange.cs'),resolve('tests/formation-exchange-vectors.cs')]);
 assert(execFileSync(exe,{encoding:'utf8'}).includes('PASS'));
 } finally {rmSync(d,{recursive:true,force:true});}
});