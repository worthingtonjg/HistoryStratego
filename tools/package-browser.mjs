import { mkdir, copyFile, cp, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
const stage = process.argv[2] || 'Builds/BrowserAuthorityStage', dest = process.argv[3] || 'Builds/BrowserRelease/docs';
await mkdir(dest, {
	recursive: true
});
await cp(stage + '/Build', dest + '/Build', {
	recursive: true
});
const currentBuildFiles = new Set(await readdir(stage + '/Build'));
for (const name of await readdir(dest + '/Build'))
	if (!currentBuildFiles.has(name) && /\.(data|wasm|js)$/.test(name))
		await unlink(dest + '/Build/' + name);
await cp('browser', dest + '/browser', {
	recursive: true
});
await copyFile('web/facts.json', dest + '/browser/facts.json');
await writeFile(dest + '/.nojekyll', '');
const source = await readFile(stage + '/index.html', 'utf8');
const loader = source.match(/src="(Build\/[^"]+loader.js)"/)[1];
const data = source.match(/dataUrl: '([^']+)'/)[1], framework = source.match(/frameworkUrl: '([^']+)'/)[1], wasm = source.match(/codeUrl: '([^']+)'/)[1];
const pageTemplate = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Civil War: Hidden Orders</title><style>
*{box-sizing:border-box}body{margin:0;height:100dvh;display:flex;flex-direction:column;background:#101b21;color:#e9eef0;font:18px system-ui}button,input{font:inherit;padding:12px;border-radius:5px;margin:6px}button{cursor:pointer;background:#e4c773;color:#10212e;border:0}input{max-width:100%;background:#233640;color:white;border:1px solid #77878f}main{max-width:760px;margin:8vh auto;padding:25px}p{line-height:1.5}h1{font-size:32px}#classroom-bar{min-height:40px;padding:6px 16px;background:#20323d;font-size:14px}#classroom-bar button{padding:4px 10px;font-size:14px}#game{flex:1;min-height:0}#classroom-bar{flex:none}canvas{display:block;width:100%;height:100%}[hidden]{display:none!important}details{padding:8px 0}#recovery-value{overflow-wrap:anywhere}#status{color:#f4d77c;min-height:28px}.fine{font-size:14px;color:#b5c3ca}
</style></head><body><main id="entry"><h1>Civil War: Hidden Orders</h1><p>A classroom strategy game using classic Stratego rules. The teacher creates a classroom; students join with its code.</p><button id="create">Create classroom (teacher)</button><hr><label>Classroom code<br><input id="join-code" autocomplete="off" placeholder="Paste your teacher’s full code" size="35"></label><button id="join">Join classroom</button><button id="reconnect" hidden>Reconnect previous session</button><details><summary>Recover teacher classroom</summary><p>Use the original browser profile and your private recovery code. Local checkpoints are not cloud backups.</p><input id="private-code" type="password" autocomplete="off" placeholder="Private recovery code" size="40"><button id="recover">Recover</button></details><p id="status" role="status"></p><p class="fine">The teacher’s browser runs the classroom. Keep it open and visible; leaving or suspending it pauses play. Playroom internet access is required. The free development plan supports 10 unique users per day; a full class may exceed it. No purchase occurs here.</p><p class="fine">This is an abstract strategy game, not a reenactment. Slavery was central to Confederate secession and the Civil War.</p></main><aside id="classroom-bar" hidden>Classroom: <strong id="public-code"></strong><span id="teacher-tools" hidden> <button id="computer">Add computer</button><span id="computer-status"></span><details><summary>Private teacher recovery code — keep private</summary><code id="recovery-value"></code><p>Save this code. Recovery requires this browser’s local checkpoint. Teacher access is not granted by becoming Playroom host.</p></details></span></aside><div id="game" hidden><canvas id="unity-canvas" tabindex="-1"></canvas></div><script src="${loader}"></script><script>window.loadUnity=()=>createUnityInstance(document.querySelector('canvas'),{dataUrl:'${data}',frameworkUrl:'${framework}',codeUrl:'${wasm}',devicePixelRatio:Math.min(devicePixelRatio||1,1.25),streamingAssetsUrl:'StreamingAssets',companyName:'History Classroom',productName:'Civil War Hidden Orders',productVersion:'0.2.0'});</script><script type="module" src="browser/bootstrap.mjs"></script></body></html>`;
const studentEntry = `<main id="entry"><h1>Civil War: Hidden Orders</h1><label>Classroom code<br><input id="join-code" autocomplete="off" placeholder="Four-character class code" size="35"></label><button id="join">Join classroom</button><p id="status" role="status"></p></main>`;
const teacherEntry = `<main id="entry"><h1>Teacher classroom</h1><button id="create" hidden>Create classroom</button><p id="status" role="status"></p></main>`;
const studentBar = `<aside id="classroom-bar" hidden>Classroom: <strong id="public-code"></strong><span id="connection-status" role="status"></span><button id="next-class" hidden>Join next class</button></aside>`;
const teacherBar = `<aside id="classroom-bar" hidden>Classroom: <strong id="public-code"></strong><span id="teacher-tools" hidden><button id="computer">Add computer</button><span id="computer-status"></span><button id="new-class">New class</button></span><span id="connection-status" role="status"></span></aside>`;
for (const role of ['student', 'teacher']) {
	const page = pageTemplate.replace('<body>', `<body data-entry="${role}">`).replace(/<main id="entry">[\s\S]*?<\/main>/, role === 'teacher' ? teacherEntry : studentEntry).replace(/<aside id="classroom-bar"[\s\S]*?<\/aside>/, role === 'teacher' ? teacherBar : studentBar);
	await writeFile(dest + '/' + role + '.html', page);
	if (role === 'student')
		await writeFile(dest + '/index.html', page);
}
console.log('Static browser release staged: ' + dest);
