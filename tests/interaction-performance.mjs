import { createAuthority, serve } from '../server/server.mjs';
import { army, move } from '../server/game.mjs';
import { launchBrowser } from './browser-helper.mjs';
import { writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
const results = [];
for (const [name, folder] of [['interaction-board', 'Builds/InteractionStage'], ['interaction-battle', 'Builds/InteractionStage']]) {
	const a = createAuthority({
		timedSetup: false,
		classCode: 'PERF'
	}), p = a.call('join', {
		classCode: 'PERF', name: 'Performance fixture'
	}), q = a.call('join', {
		classCode: 'PERF', name: 'Opponent'
	});
	a.call('teacher/start', {}, a.teacherKey);
	a.call('setup', {
		ranks: army()
	}, p.token);
	a.call('setup', {
		ranks: army()
	}, q.token);
	if (name === 'interaction-battle') {
		const m = [...a.matches.values()][0];
		m.board[60] = {
			id: 'attacker', side: 0, rank: '3'
		};
		m.board[50] = {
			id: 'defender', side: 1, rank: 'B'
		};
		move(m, 0, 60, 50, m.seq, 'performance-battle');
	}
	const server = serve(a, 0, folder);
	await new Promise(r => server.on('listening', r));
	let browser;
	try {
		browser = await launchBrowser();
		const page = await browser.page('http://127.0.0.1:' + server.address().port + '/unity/index.html', {
			blockSdk: true, width: 1366, height: 900, initScript: "sessionStorage.setItem('studentToken'," + JSON.stringify(p.token) + ");window.__errors=[];addEventListener('error',e=>window.__errors.push(e.message));"
		});
		await page.wait('!!window.unityInstance', 120000);
		await new Promise(r => setTimeout(r, 8000));
		await page.screenshot('docs/evidence/' + name + '-performance.png');
		const before = await browser.send('SystemInfo.getProcessInfo'), start = performance.now();
		await new Promise(r => setTimeout(r, 10000));
		const after = await browser.send('SystemInfo.getProcessInfo'), elapsed = (performance.now() - start) / 1000;
		const previous = new Map(before.processInfo.map(p => [p.id, p.cpuTime]));
		const cpu = after.processInfo.reduce((sum, p) => sum + (previous.has(p.id) ? Math.max(0, p.cpuTime - previous.get(p.id)) : 0), 0);
		const errors = await page.evaluate('window.__errors');
		errors.push(...page.logs.filter(e => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error').map(e => e.params.args.map(a => a.value || a.description).join(' ')).filter(e => !e.includes('Playroom')));
		const item = {
			name, viewport: [1366, 900], renderer: 'headless Chrome SwiftShader software WebGL', logicalProcessors: cpus().length, sampleSeconds: elapsed, cpuSeconds: cpu, oneCorePercent: cpu / elapsed * 100, totalMachineCpuPercent: cpu / elapsed / cpus().length * 100, errors
		};
		results.push(item);
		console.log(JSON.stringify(item));
	}
	finally {
		if (browser)
			await browser.close();
		await new Promise(r => server.close(r));
	}
}
await writeFile('docs/evidence/interaction-performance.json', JSON.stringify({
	utc: new Date().toISOString(), results
}, null, 2));
