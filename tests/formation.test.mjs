import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFormation } from '../web/formation.mjs';
import { COUNTS, createMatch, setup, view } from '../server/game.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
export function checkFormation(ranks) {
	assert.equal(ranks.length, 40);
	for (const [r, n] of Object.entries(COUNTS))
		assert.equal(ranks.filter(x => x === r).length, n, r);
	const f = ranks.indexOf('F');
	assert(f >= 30 && f < 40);
	assert.equal(ranks[f - 10], 'B');
	if (f % 10 > 0)
		assert.equal(ranks[f - 1], 'B');
	if (f % 10 < 9)
		assert.equal(ranks[f + 1], 'B');
	assert.equal(ranks.slice(0, 10).filter(r => r === '2').length, 8);
	assert(ranks.every(r => Object.hasOwn(COUNTS, r)));
}
test('seeded constrained formations cover both orientations, corners, counts and independent variation', () => {
	const columns = new Set(), unique = new Set();
	for (let seed = 0; seed < 256; seed++) {
		const ranks = generateFormation(Math.imul(seed, 2654435761));
		checkFormation(ranks);
		columns.add(ranks.indexOf('F') % 10);
		unique.add(ranks.join(','));
		for (const side of [0, 1]) {
			const m = createMatch(['a', 'b']);
			setup(m, side, ranks);
			const board = m.board, flag = board.findIndex(p => p?.rank === 'F');
			assert.equal(Math.floor(flag / 10), side === 0 ? 9 : 0);
			assert.equal(board[flag + (side === 0 ? -10 : 10)].rank, 'B');
			for (const d of [-1, 1])
				if (Math.floor((flag + d) / 10) === Math.floor(flag / 10))
					assert.equal(board[flag + d].rank, 'B');
			assert.equal(board.filter((p, i) => p?.rank === '2' && Math.floor(i / 10) === (side === 0 ? 6 : 3)).length, 8);
			assert.equal(board.filter(Boolean).length, 40);
			assert(view(m, 1 - side).board.filter(Boolean).every(p => p.rank === '?'));
		}
	}
	assert.equal(columns.size, 10);
	assert.equal(unique.size, 256);
	assert.notDeepEqual(generateFormation(1234), generateFormation(5678));
});
test('manual swaps remain valid setup choices rather than enforced placement rules', () => {
	const ranks = generateFormation(123), f = ranks.indexOf('F');
	[ranks[f], ranks[0]] = [ranks[0], ranks[f]];
	for (const side of [0, 1]) {
		const m = createMatch(['a', 'b']);
		setup(m, side, ranks);
		assert(m.ready[side]);
	}
});
test('C# Unity and browser/demo algorithms match 256 deterministic seed vectors', {
	skip: process.platform !== 'win32'
}, () => {
	const dir = mkdtempSync(join(tmpdir(), 'formation-vectors-'));
	try {
		const exe = join(dir, 'vectors.exe'), compiler = join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
		execFileSync(compiler, ['/nologo', '/out:' + exe, resolve('Assets/Scripts/ArmyFormation.cs'), resolve('tests/formation-vectors.cs')]);
		const lines = execFileSync(exe, [], {
			encoding: 'utf8'
		}).trim().split(/\r?\n/);
		assert.equal(lines.length, 256);
		for (let seed = 0; seed < 256; seed++)
			assert.equal(lines[seed], generateFormation(Math.imul(seed, 2654435761)).join(','), 'seed ' + seed);
	}
	finally {
		rmSync(dir, {
			recursive: true, force: true
		});
	}
});
