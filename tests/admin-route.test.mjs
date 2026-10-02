import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('nested administrative entry resolves existing static assets at the project root', () => {
	const base = new URL('../', 'https://worthingtonjg.github.io/HistoryStratego/admin/');
	assert.equal(new URL('Build/test.wasm', base).href, 'https://worthingtonjg.github.io/HistoryStratego/Build/test.wasm');
	assert.equal(new URL('browser/bootstrap.mjs', base).href, 'https://worthingtonjg.github.io/HistoryStratego/browser/bootstrap.mjs');
	assert.equal(new URL('../admin/', 'https://worthingtonjg.github.io/HistoryStratego/browser/bootstrap.mjs').href, 'https://worthingtonjg.github.io/HistoryStratego/admin/');
	const source = readFileSync('tools/package-browser.mjs', 'utf8');
	assert(source.includes("'/admin/index.html'"));
	assert(source.includes('<base href="../">'));
	assert(source.includes("unlink(dest + '/teacher.html')"));
});
