import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
test('compiled own-view selection policy follows piece lineage and deterministic legal fallback', {
	skip: process.platform !== 'win32'
}, () => {
	const dir = mkdtempSync(join(tmpdir(), 'auto-selection-'));
	try {
		const unity = 'C:/Program Files/Unity/Hub/Editor/6000.5.2f1/Editor/Data';
		const framework = join(process.env.WINDIR, 'Microsoft.NET/Framework64/v4.0.30319');
		const exe = join(dir, 'selection-tests.exe');
		execFileSync(join(unity, 'NetCoreRuntime/dotnet.exe'), [
			join(unity, 'DotNetSdk/sdk/8.0.318/Roslyn/bincore/csc.dll'),
			'/nologo', '/nostdlib+', '/out:' + exe,
			'/reference:' + join(framework, 'mscorlib.dll'),
			'/reference:' + join(framework, 'System.Core.dll'),
			resolve('Assets/Scripts/AutoSelectionPolicy.cs'),
			resolve('tests/auto-selection-vectors.cs')
		]);
		assert.match(execFileSync(exe, [], {
			encoding: 'utf8'
		}), /PASS own identity/);
	}
	finally {
		rmSync(dir, {
			recursive: true, force: true
		});
	}
});
