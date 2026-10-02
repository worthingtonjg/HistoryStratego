import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export async function launchBrowser() {
	const profile = await mkdtemp(join(tmpdir(), 'history-chrome-'));
	const child = process.env.REUSE_BROWSER_PORT ? null : spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [...(process.env.KEEP_PREVIEW_BROWSER ? [] : ['--headless=new']), '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--remote-allow-origins=*', '--user-data-dir=' + profile, 'about:blank'], {
		windowsHide: true, stdio: 'ignore'
	});
	let port = process.env.REUSE_BROWSER_PORT;
	for (let i = 0; !port && i < 60; i++) {
		try {
			port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
			break;
		}
		catch {
			await new Promise(r => setTimeout(r, 250));
		}
	}
	if (!port)
		throw Error('Chrome DevTools did not start');
	const info = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json(), ws = new WebSocket(info.webSocketDebuggerUrl);
	await new Promise((r, j) => {
		ws.onopen = r;
		ws.onerror = j;
	});
	const ownedContexts = [];
	let id = 0;
	const pending = new Map(), events = new Map();
	ws.onmessage = e => {
		const v = JSON.parse(e.data);
		if (!v.id && events.has(v.sessionId))
			events.get(v.sessionId).push(v);
		if (v.id) {
			const p = pending.get(v.id);
			pending.delete(v.id);
			v.error ? p.reject(Error(v.error.message)) : p.resolve(v.result);
		}
	};
	function send(method, params = {}, sessionId) {
		return new Promise((resolve, reject) => {
			const n = ++id;
			pending.set(n, {
				resolve, reject
			});
			ws.send(JSON.stringify({
				id: n, method, params, sessionId
			}));
		});
	}
	async function page(url, { blockSdk = false, initScript = "", width = 1280, height = 1000, deviceScaleFactor = 1 } = {}) {
		const context = await send('Target.createBrowserContext');
		ownedContexts.push(context.browserContextId);
		const t = await send('Target.createTarget', {
			url: 'about:blank', browserContextId: context.browserContextId
		});
		const { sessionId } = await send('Target.attachToTarget', {
			targetId: t.targetId, flatten: true
		});
		const call = (m, p) => send(m, p, sessionId);
		const logs = [];
		events.set(sessionId, logs);
		await call('Page.enable');
		if (initScript)
			await call('Page.addScriptToEvaluateOnNewDocument', {
				source: initScript
			});
		if (blockSdk) {
			await call('Network.enable');
			await call('Network.setBlockedURLs', {
				urls: ['*esm.sh*']
			});
		}
		await call('Runtime.enable');
		await call('Emulation.setDeviceMetricsOverride', {
			width, height, deviceScaleFactor, mobile: false
		});
		await call('Page.navigate', {
			url
		});
		const evaluate = async (expression) => {
			const v = await call('Runtime.evaluate', {
				expression, awaitPromise: true, returnByValue: true
			});
			if (v.exceptionDetails)
				throw Error(v.exceptionDetails.text + ': ' + v.exceptionDetails.exception?.description);
			return v.result.value;
		};
		async function wait(expression, ms = 20000) {
			const until = Date.now() + ms;
			while (Date.now() < until) {
				if (await evaluate(expression))
					return;
				await new Promise(r => setTimeout(r, 100));
			}
			throw Error('Timed out: ' + expression);
		}
		await wait('document.readyState==="complete"');
		return {
			call, evaluate, wait, logs, screenshot: async (path) => {
				const v = await call('Page.captureScreenshot', {
					format: 'png'
				});
				await writeFile(path, Buffer.from(v.data, 'base64'));
			}
		};
	}
	return {
		page, send, keepPreview: async (url) => {
			for (const browserContextId of ownedContexts)
				await send('Target.disposeBrowserContext', {
					browserContextId
				});
			const { targetInfos } = await send('Target.getTargets');
			if (!targetInfos.some(t => t.type === 'page' && t.url === url))
				await send('Target.createTarget', {
					url
				});
			// Existing user tabs, credentials, and foreground focus are preserved.
			ws.close();
			child?.unref();
		}, close: async () => {
			try {
				await send('Browser.close');
			}
			catch {
			}
			ws.close();
			child?.kill();
		}
	};
}
