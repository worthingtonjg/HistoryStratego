import assert from 'node:assert/strict';
import { createAuthority, serve } from '../server/server.mjs';
import { launchBrowser } from './browser-helper.mjs';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const a = createAuthority({
	timedSetup: false,
	classCode: 'STATUS'
}), student = a.call('join', {
	classCode: 'STATUS', name: 'Status check'
});
let server = serve(a, 0, 'Builds/PresentationStage');
await new Promise(r => server.on('listening', r));
const port = server.address().port, browser = await launchBrowser();
const init = "sessionStorage.setItem('studentToken'," + JSON.stringify(student.token) + ");window.__slowPolls=0;const rawFetch=window.fetch;window.fetch=async function(input,...rest){if(String(input).endsWith('/api/state')){window.__slowPolls++;await new Promise(r=>setTimeout(r,350));}return rawFetch.call(this,input,...rest);};const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.open=function(method,url,...rest){this._poll=String(url).endsWith('/api/state');return open.call(this,method,url,...rest);};XMLHttpRequest.prototype.send=function(...args){if(this._poll)setTimeout(()=>send.apply(this,args),350);else send.apply(this,args);};Object.defineProperty(window,'unityInstance',{get(){return window.__unity},set(v){window.__unity=v;const send=v.SendMessage.bind(v);v.SendMessage=(go,method,arg)=>{if(method==='PresenceStatus')window.__presenceStatus=arg;return send(go,method,arg);};}});";
try {
	const p = await browser.page('http://127.0.0.1:' + port + '/unity/index.html', {
		initScript: init, blockSdk: true
	});
	await p.wait('!!window.unityInstance', 120000);
	await p.wait("window.__presenceStatus?.includes('unavailable')", 30000);
	await new Promise(r => setTimeout(r, 2500));
	const hashes = [];
	for (let i = 0; i < 8; i++) {
		const r = await p.call('Page.captureScreenshot', {
			format: 'png', clip: {
				x: 28, y: 762, width: 1220, height: 50, scale: 1
			}
		});
		hashes.push(createHash('sha256').update(r.data).digest('hex'));
		await new Promise(r => setTimeout(r, 500));
	}
	assert((await p.evaluate('window.__slowPolls')) >= 4, 'Unity fetch polls must actually be delayed');
	assert.equal(new Set(hashes).size, 1, 'routine slow polls must not alter connection footer');
	await p.screenshot('docs/evidence/presentation-status-stable.png');
	const closed = new Promise(r => server.close(r));
	server.closeAllConnections();
	await closed;
	const logs = () => p.logs.filter(e => e.method === 'Runtime.consoleAPICalled').flatMap(e => e.params.args.map(a => a.value || ''));
	for (let i = 0; i < 50 && !logs().some(s => String(s).includes('CLASSROOM_CONNECTION offline')); i++)
		await new Promise(r => setTimeout(r, 200));
	assert(logs().some(s => String(s).includes('CLASSROOM_CONNECTION offline')));
	await p.screenshot('docs/evidence/presentation-status-offline.png');
	server = serve(a, port, 'Builds/PresentationStage');
	await new Promise(r => server.on('listening', r));
	for (let i = 0; i < 50 && !logs().some(s => String(s).includes('CLASSROOM_CONNECTION restored')); i++)
		await new Promise(r => setTimeout(r, 200));
	assert(logs().some(s => String(s).includes('CLASSROOM_CONNECTION restored')));
	await p.screenshot('docs/evidence/presentation-status-recovered.png');
	await p.call('Network.setBlockedURLs', {
		urls: []
	});
	await p.call('Page.reload');
	await p.wait('!!window.unityInstance', 120000);
	await p.wait("window.__presenceStatus?.includes('Playroom connected')", 45000);
	await p.screenshot('docs/evidence/presentation-status-sdk-recovered.png');
	await writeFile('docs/evidence/presentation-status-result.json', JSON.stringify({
		result: 'passed', utc: new Date().toISOString(), sourceSha256: createHash('sha256').update(await readFile('Assets/Scripts/HistoryGame.cs')).digest('hex'), wasmSha256: createHash('sha256').update(await readFile('Builds/PresentationStage/Build/PresentationStage.wasm')).digest('hex'), checks: ['8 pixel-identical footer samples while routine API polls deliberately delayed', 'actual test server stopped: offline/stale message observed', 'same authority restarted: recovered message observed', 'SDK blocked-load failure visible; reload with network available connected live']
	}, null, 2));
	console.log('PASS stable polling footer, real API outage/recovery and SDK failure/reload recovery.');
}
finally {
	await browser.close();
	server.close();
	server.closeAllConnections();
}
