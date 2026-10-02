import { installMatchLog } from './match-log.mjs';
import { installJoinPanel } from './join-panel.mjs';
import { acceptUnityTeacherGate } from './teacher-access.mjs';
import { currentClassroom, isRetired, rememberClassroom } from './classroom-memory.mjs';
import { connectClassroom } from './transport.mjs';
const nativeFetch = window.fetch.bind(window), root = new URL('./', import.meta.url);
const status = document.querySelector('#status'), panel = document.querySelector('#entry'), toolbar = document.querySelector('#classroom-bar');
let runtime, starting = false, teacherAccess = null;
const teacherPage = document.body.dataset.entry === 'teacher';
let unityPromise;
const unity = () => unityPromise ||= window.loadUnity().then(instance => (window.unityInstance = instance));
const setStatus = s => {
	status.textContent = s;
	if (!teacherPage && s.startsWith('Class ended'))
		showClassEnded();
	const visibleStatus = document.querySelector('#connection-status');
	if (visibleStatus)
		visibleStatus.textContent = s;
};
function showClassEnded() {
	const next = document.querySelector('#next-class');
	if (next)
		next.hidden = false;
	const message = document.querySelector('#connection-status');
	if (message)
		message.textContent = 'Class ended. Ask your teacher for the next code.';
}
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
			if (value.classCode)
				value.classCode = runtime.joinCode;
			if (!teacherPage && value.phase === 'ended')
				showClassEnded();
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
			role, code, recovery, onStatus: setStatus, teacherAccess
		});
		window.historyClassroom = runtime;
		window.historyPresenceStatus = () => 'Playroom classroom ' + runtime.joinCode + (runtime.role === 'teacher' ? ' | Teacher authority' : '');
		sessionStorage.setItem('history.browserSession', JSON.stringify({
			role: runtime.role, code: runtime.code, recovery: runtime.role === 'teacher' ? runtime.recovery : ''
		}));
		if (role === 'teacher')
			sessionStorage.removeItem('studentToken');
		document.querySelector('#public-code').textContent = runtime.joinCode;
		if (runtime.role === 'teacher') {
			document.querySelector('#teacher-tools').hidden = false;
			document.querySelector('#computer').onclick = async () => {
				const bot = await runtime.addComputer();
				document.querySelector('#computer-status').textContent = 'Computer joined: ' + bot.name;
			};
		}
		panel.hidden = true;
		toolbar.hidden = false;
		document.querySelector('#game').hidden = false;
		const instance = await unity();
		window.unityInstance = instance;
		await new Promise(r => setTimeout(r, 600));
		instance.SendMessage('HistoryGame', 'BrowserLogin', JSON.stringify({
			role: runtime.role, code: runtime.code, key: runtime.teacherKey
		}));
		starting = false;
	}
	catch (e) {
		setStatus(e.message);
		starting = false;
	}
}
async function unlockTeacher() {
	if (!teacherPage || teacherAccess)
		return;
	teacherAccess = acceptUnityTeacherGate();
	let previous = currentClassroom();
	// Adopt this browser tab's earlier release session after the Unity key was checked.
	if (!previous) {
		try {
			const legacy = JSON.parse(sessionStorage.getItem('history.browserSession') || 'null');
			if (legacy?.role === 'teacher' && legacy.recovery && !isRetired(legacy.code)) {
				rememberClassroom(legacy.code, legacy.recovery);
				previous = currentClassroom();
			}
		}
		catch {
		}
	}
	if (previous)
		await start('recover', previous.code, previous.recovery);
	else if (sessionStorage.getItem('history.newClass') === '1') {
		sessionStorage.removeItem('history.newClass');
		await start('teacher');
	}
	else {
		document.querySelector('#game').hidden = true;
		panel.hidden = false;
		document.querySelector('#create').hidden = false;
		setStatus('Teacher unlocked. Create a classroom when ready.');
	}
}
if (teacherPage) {
	const matchLog = installMatchLog({
		dialog: document.querySelector('#match-log'), title: document.querySelector('#match-log-title'), list: document.querySelector('#match-log-events'), closeButton: document.querySelector('#close-match-log'), refreshButton: document.querySelector('#refresh-match-log'), request: (route, body) => runtime.request(route, body), document
	});
	window.historyOpenMatchLog = id => runtime?.role === 'teacher' ? matchLog.open(id) : undefined;
	installJoinPanel({
		button: document.querySelector('#show-join'), dialog: document.querySelector('#join-panel'), codeElement: document.querySelector('#projector-code'), urlElement: document.querySelector('#student-address'), closeButton: document.querySelector('#close-join'), getCode: () => runtime?.joinCode || ''
	});
	window.historyTeacherUnlocked = unlockTeacher;
	document.querySelector('#create').onclick = () => {
		if (teacherAccess)
			start('teacher');
	};
	document.querySelector('#new-class').onclick = async () => {
		if (!runtime || runtime.role !== 'teacher' || !teacherAccess || starting)
			return;
		if (!window.confirm('End this class for every student and create a fresh classroom? The old code will stop working.'))
			return;
		starting = true;
		try {
			await runtime.retire();
			sessionStorage.removeItem('history.browserSession');
			sessionStorage.setItem('history.newClass', '1');
			// Reinitializing Playroom in a clean page avoids reusing its previous room/session.
			location.replace(new URL('../admin/', import.meta.url));
		}
		catch (e) {
			starting = false;
			setStatus(e.message);
		}
	};
	panel.hidden = true;
	document.querySelector('#game').hidden = false;
	unity().catch(e => {
		panel.hidden = false;
		setStatus(e.message);
	});
}
else {
	document.querySelector('#join').onclick = () => {
		const code = document.querySelector('#join-code').value.trim().toUpperCase();
		let prior;
		try {
			prior = JSON.parse(sessionStorage.getItem('history.browserSession') || 'null');
		}
		catch {
		}
		if (!prior || (prior.code !== code && prior.code?.split('-')[0] !== code))
			sessionStorage.removeItem('studentToken');
		sessionStorage.setItem('history.browserSession', JSON.stringify({
			role: 'student', code
		}));
		location.replace(new URL('student.html', location.href));
	};
	document.querySelector('#next-class').onclick = () => {
		sessionStorage.removeItem('history.browserSession');
		sessionStorage.removeItem('studentToken');
		location.replace(new URL('student.html', location.href));
	};
	// Student-only refresh reuses its own seat, never a saved teacher session.
	try {
		const previous = JSON.parse(sessionStorage.getItem('history.browserSession') || 'null');
		if (previous?.role === 'student') {
			document.querySelector('#join-code').value = previous.code;
			start('student', previous.code);
		}
	}
	catch {
	}
}
window.addEventListener('pagehide', () => runtime?.close());
