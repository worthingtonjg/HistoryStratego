import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
test('optimistic preview survives stale reads, accepts once, and rolls back conflicts or interrupted context', () => {
 const d=mkdtempSync(join(tmpdir(),'history-exchange-')), exe=join(d,'exchange.exe');
 try {
 execFileSync(join(process.env.WINDIR,'Microsoft.NET','Framework64','v4.0.30319','csc.exe'),['/nologo','/out:'+exe,resolve('Assets/Scripts/FormationExchange.cs'),resolve('Assets/Scripts/FormationSwapPreview.cs'),resolve('tests/swap-preview-vectors.cs')]);
 assert(execFileSync(exe,{encoding:'utf8'}).includes('PASS'));
 } finally {rmSync(d,{recursive:true,force:true});}
});