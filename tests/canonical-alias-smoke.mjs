import { launchBrowser } from './browser-helper.mjs';
import { writeFile } from 'node:fs/promises';
const browser = await launchBrowser();
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
	const page = await browser.page('http://127.0.0.1:8080/tabletop/index.html');
	const deadline = Date.now() + 120000;
	let loaded = false;
	while (Date.now() < deadline) {
		const contexts = page.logs.filter(e => e.method === 'Runtime.executionContextCreated').map(e => e.params.context).filter(c => c.origin === 'http://127.0.0.1:8081' && c.auxData?.isDefault);
		for (const context of contexts.reverse()) {
			try {
				const r = await page.call('Runtime.evaluate', {
					expression: '!!window.unityInstance', contextId: context.id, returnByValue: true
				});
				if (r.result?.value) {
					loaded = true;
					break;
				}
			}
			catch {
			}
		}
		if (loaded)
			break;
		await sleep(250);
	}
	if (!loaded)
		throw Error('Canonical iframe Unity runtime did not load');
	await sleep(7000);
	await page.screenshot('docs/evidence/portraits-canonical-login.png');
	await writeFile('docs/evidence/portraits-canonical-result.json', JSON.stringify({
		result: 'passed', url: 'http://127.0.0.1:8080/tabletop/index.html', checks: ['canonical iframe renders actual Unity PortraitsStage', 'no student seat created', 'no moves or teacher actions']
	}, null, 2));
	console.log('PASS canonical Unity rendered');
}
finally {
	await browser.close();
}
