import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COMMANDERS } from '../server/commanders.mjs';
test('every roster commander has one verified portrait with retained provenance', () => {
	const provenance = JSON.parse(readFileSync('docs/commander-portraits.json', 'utf8'));
	const folder = 'Assets/Resources/CommanderPortraits/';
	const expected = COMMANDERS.map(c => c.id).sort();
	assert.deepEqual(Object.keys(provenance).sort(), expected);
	assert.equal(new Set(Object.values(provenance).map(p => p.sha256)).size, expected.length, "portraits are distinct files");
	assert.deepEqual(readdirSync(folder).filter(n => n.endsWith('.png')).map(n => n.slice(0, -4)).sort(), expected);
	for (const c of COMMANDERS) {
		const p = provenance[c.id];
		const bytes = readFileSync(folder + c.id + '.png');
		assert.equal(createHash('sha256').update(bytes).digest('hex'), p.sha256, c.id);
		assert.equal(p.leaderID, c.id);
		assert.equal(p.fullName, c.fullName);
		assert.equal(p.faction, c.faction);
		assert.equal(p.resource, 'CommanderPortraits/' + c.id);
		assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], p.dimensions);
		assert.ok(p.references.length > 0);
		assert.ok(p.accuracyNote.includes('illustrated'));
	}
});
