import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createAuthority, serve } from '../server/server.mjs';
import { launchBrowser } from './browser-helper.mjs';
const a = createAuthority({
	timedSetup: false,
	teacherKey: 'layout-test', classCode: 'SIZE'
}), server = serve(a, 0);
await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
let browser;
const checks = [];
async function click(p, x, y, w, h) {
	const z = Math.min(w / 1200, h / 900);
	x = x * z + (w - 1200 * z) / 2;
	y = y * z + (h - 900 * z) / 2;
	await p.call('Input.dispatchMouseEvent', {
		type: 'mousePressed', x, y, button: 'left', clickCount: 1
	});
	await new Promise(r => setTimeout(r, 100));
	await p.call('Input.dispatchMouseEvent', {
		type: 'mouseReleased', x, y, button: 'left', clickCount: 1
	});
	await new Promise(r => setTimeout(r, 150));
}
async function type(p, x, y, text, w, h) {
	await click(p, x, y, w, h);
	for (const key of text) {
		await p.call('Input.dispatchKeyEvent', {
			type: 'keyDown', key, text: key
		});
		await p.call('Input.dispatchKeyEvent', {
			type: 'keyUp', key
		});
	}
}
try {
	await mkdir('docs/evidence', {
		recursive: true
	});
	browser = await launchBrowser();
	for (const [w, h, dpr] of [[1920, 860, 1], [1366, 768, 1], [1920, 1080, 1], [850, 900, 1], [1366, 768, 2]]) {
		const p = await browser.page(base + '/unity/index.html', {
			blockSdk: true, width: w, height: h, deviceScaleFactor: dpr
		});
		await p.wait('!!window.unityInstance', 120000);
		await new Promise(r => setTimeout(r, 5000));
		const dim = await p.evaluate("(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {width:c.width,height:c.height,cssWidth:r.width,cssHeight:r.height,dpr:devicePixelRatio,title:document.title}})()");
		assert.match(dim.title, /Civil War/);
		assert(Math.abs(dim.width / dim.height - w / h) < .02);
		await p.screenshot('docs/evidence/layout-login-' + w + 'x' + h + '-' + dpr + '.png');
		await type(p, 350, 123, 'SIZE', w, h);
		await type(p, 350, 163, 'Layout ' + w + ' ' + dpr, w, h);
		await click(p, 350, 206, w, h);
		await p.wait("!!sessionStorage.getItem('studentToken')", 20000);
		await new Promise(r => setTimeout(r, 1800));
		assert.equal(await p.evaluate("fetch('/api/state',{method:'POST',headers:{Authorization:'Bearer '+sessionStorage.getItem('studentToken')}}).then(r=>r.json()).then(s=>s.match)"), null);
		await p.screenshot('docs/evidence/layout-waiting-' + w + 'x' + h + '-' + dpr + '.png');
		if (w === 1920 && h === 860) {
			await p.call('Emulation.setDeviceMetricsOverride', {
				width: 1366, height: 768, deviceScaleFactor: 1, mobile: false
			});
			await new Promise(r => setTimeout(r, 1500));
			await p.screenshot('docs/evidence/layout-resized.png');
		}
		checks.push({
			viewport: [w, h], dpr, canvas: dim, canvasJoinPassed: true
		});
		console.log('PASS first-load, canvas join and waiting room ' + w + 'x' + h + ' DPR ' + dpr);
	}
	await writeFile('docs/evidence/layout-result.json', JSON.stringify({
		utc: new Date().toISOString(), checks
	}, null, 2));
}
finally {
	if (browser)
		await browser.close();
	server.close();
}
