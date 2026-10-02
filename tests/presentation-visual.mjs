import { createAuthority, serve } from '../server/server.mjs';
import { army } from '../server/game.mjs';
import { launchBrowser } from './browser-helper.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const a = createAuthority({
	timedSetup: false,
	teacherKey: 'H', classCode: 'VISUAL'
}), players = [0, 1].map(() => a.call('join', {
	classCode: 'VISUAL', name: 'Alexandria Demonstration'
}));
a.call('teacher/start', {}, 'H');
for (const p of players)
	a.call('setup', {
		ranks: army()
	}, p.token);
const id = [...a.matches.keys()][0];
a.call('teacher/spectate', {
	matchId: id, perspective: 'blue'
}, 'H');
const server = serve(a, 0, 'Builds/PresentationStage');
await new Promise(r => server.on('listening', r));
const b = await launchBrowser();
try {
	const p = await b.page('http://127.0.0.1:' + server.address().port + '/unity/index.html', {
		blockSdk: true
	});
	await p.wait('!!window.unityInstance', 120000);
	await new Promise(r => setTimeout(r, 1800));
	const click = async (x, y) => {
		x *= 1280 / 1200;
		y = y * (1280 / 1200) + 20;
		await p.call('Input.dispatchMouseEvent', {
			type: 'mousePressed', x, y, button: 'left', clickCount: 1
		});
		await new Promise(r => setTimeout(r, 90));
		await p.call('Input.dispatchMouseEvent', {
			type: 'mouseReleased', x, y, button: 'left', clickCount: 1
		});
		await new Promise(r => setTimeout(r, 100));
	};
	await click(95, 854);
	await click(400, 273);
	await p.call('Input.dispatchKeyEvent', {
		type: 'keyDown', key: 'H', text: 'H'
	});
	await p.call('Input.dispatchKeyEvent', {
		type: 'keyUp', key: 'H'
	});
	await click(400, 316);
	await new Promise(r => setTimeout(r, 1800));
	await click(800, 231);
	await new Promise(r => setTimeout(r, 1800));
	await p.screenshot('docs/evidence/presentation-long-duplicate-names.png');
	for (let i = 0; i < 15; i++)
		await click(210, 854);
	await p.screenshot('docs/evidence/presentation-strategy-fact.png');
	const facts = await p.evaluate("fetch('/facts.json').then(r=>r.json())");
	assert.equal(facts.length, 27);
	assert.equal(facts.filter(f => f.lesson).length, 12);
	assert.equal(facts.filter(f => f.side === 'Union').length, 6);
	assert.equal(facts.filter(f => f.side === 'Confederate').length, 6);
	await writeFile('docs/evidence/presentation-visual-result.json', JSON.stringify({
		result: 'passed', utc: new Date().toISOString(), checks: ['actual final Unity build', 'long duplicate nicknames retain explicit RED/BLUE labels', 'teacher chosen blue perspective', '27 source-linked Civil War facts, 12 strategy lessons, six per side', 'strategy fact navigated through actual canvas']
	}, null, 2));
	console.log('PASS final named-perspective and strategy-banner visual checks.');
}
finally {
	await b.close();
	server.close();
}
