import { connectClassroom } from './transport.mjs';
const nativeFetch = window.fetch.bind(window), root = new URL('./', import.meta.url);
const status = document.querySelector('#status'), panel = document.querySelector('#entry'), toolbar = document.querySelector('#classroom-bar');
let runtime, starting = false;
const setStatus = s => {
	status.textContent = s;
};
window.fetch = async (input, options = {}) => {
	const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, location.href);
	if (url.pathname === '/facts.json')
		return nativeFetch(new URL('./facts.json', root));
	if (url.pathname.startsWith('/api/')) {
		try {
			window.historyApiOrigin = url.origin;
			if (!runtime)
				throw Error('Connect to a classroom first');
			const body = options.body ?? (input instanceof Request ? await input.clone().text() : '{}'), text = typeof body === 'string' ? body : await new Response(body).text();
			const headers = new Headers(options.headers || {}), token = (headers.get('Authorization') || '').replace(/^Bearer /, '');
			const value = await runtime.request(url.pathname.slice(5), JSON.parse(text), token);
			return new Response(JSON.stringify(value), {
				status: value.error ? 400 : 200, headers: {
					'Content-Type': 'application/json'
				}
			});
		}
		catch (e) {
			window.historyFetchError = e.message;
			return new Response(JSON.stringify({
				error: e.message
			}), {
				status: 503, headers: {
					'Content-Type': 'application/json'
				}
			});
		}
	}
	return nativeFetch(input, options);
};
async function start(role, code = '', recovery = '') {
	if (starting)
		return;
	starting = true;
	setStatus('Connecting to Playroom...');
	try {
		runtime = await connectClassroom({
			role, code, recovery, onStatus: setStatus
		});
		window.historyClassroom = runtime;
		window.historyPresenceStatus = () => 'Playroom classroom ' + runtime.code + (runtime.role === 'teacher' ? ' | Teacher authority' : '');
		sessionStorage.setItem('history.browserSession', JSON.stringify({
			role: runtime.role, code: runtime.code, recovery: runtime.role === 'teacher' ? runtime.recovery : ''
		}));
		if (role === 'teacher')
			sessionStorage.removeItem('studentToken');
		document.querySelector('#public-code').textContent = runtime.code;
		if (runtime.role === 'teacher') {
			document.querySelector('#teacher-tools').hidden = false;
			document.querySelector('#recovery-value').textContent = runtime.recovery;
			document.querySelector('#computer').onclick = async () => {
				const bot = await runtime.addComputer();
				document.querySelector('#computer-status').textContent = 'Computer joined: ' + bot.name;
			};
		}
		panel.hidden = true;
		toolbar.hidden = false;
		document.querySelector('#game').hidden = false;
		const instance = await window.loadUnity();
		window.unityInstance = instance;
		await new Promise(r => setTimeout(r, 600));
		instance.SendMessage('HistoryGame', 'BrowserLogin', JSON.stringify({
			role: runtime.role, code: runtime.code, key: runtime.teacherKey
		}));
	}
	catch (e) {
		setStatus(e.message);
		starting = false;
	}
}
document.querySelector('#create').onclick = () => start('teacher');
document.querySelector('#join').onclick = () => start('student', document.querySelector('#join-code').value.trim().toUpperCase());
document.querySelector('#recover').onclick = () => start('recover', document.querySelector('#join-code').value.trim().toUpperCase(), document.querySelector('#private-code').value.trim());
const previous = JSON.parse(sessionStorage.getItem('history.browserSession') || 'null');
if (previous) {
	const b = document.querySelector('#reconnect');
	b.hidden = false;
	b.onclick = () => start(previous.role === 'teacher' ? 'recover' : 'student', previous.code, previous.recovery);
}
window.addEventListener('pagehide', () => runtime?.close());
