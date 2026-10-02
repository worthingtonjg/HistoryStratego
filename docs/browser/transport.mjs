import { createAuthority } from './engine/authority.mjs';
const SDK = 'https://esm.sh/playroomkit@0.0.97?bundle';
// Public client identifier, not a private API credential.
const GAME_ID = 'zN6Oyc9pDGlt60CITwGe';
const enc = new TextEncoder(), dec = new TextDecoder();
const hex = a => Array.from(new Uint8Array(a), x => x.toString(16).padStart(2, '0')).join('');
const bytes = s => Uint8Array.from(s.match(/../g) || [], x => parseInt(x, 16));
const b64 = a => btoa(String.fromCharCode(...new Uint8Array(a)));
const un64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function fingerprint(pub) {
	return hex(await crypto.subtle.digest('SHA-256', enc.encode(pub))).slice(0, 16).toUpperCase();
}
async function keyPair(saved) {
	if (saved)
		return {
			privateKey: await crypto.subtle.importKey('jwk', saved.privateKey, {
				name: 'ECDH', namedCurve: 'P-256'
			}, true, ['deriveKey']), publicKey: await crypto.subtle.importKey('raw', un64(saved.pub), {
				name: 'ECDH', namedCurve: 'P-256'
			}, true, [])
		};
	return crypto.subtle.generateKey({
		name: 'ECDH', namedCurve: 'P-256'
	}, true, ['deriveKey']);
}
async function shared(pair, pub) {
	return crypto.subtle.deriveKey({
		name: 'ECDH', public: await crypto.subtle.importKey('raw', un64(pub), {
			name: 'ECDH', namedCurve: 'P-256'
		}, false, [])
	}, pair.privateKey, {
		name: 'AES-GCM', length: 256
	}, false, ['encrypt', 'decrypt']);
}
export async function seal(key, value) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	return {
		iv: b64(iv), data: b64(await crypto.subtle.encrypt({
			name: 'AES-GCM', iv
		}, key, enc.encode(JSON.stringify(value))))
	};
}
export async function open(key, packet) {
	return JSON.parse(dec.decode(await crypto.subtle.decrypt({
		name: 'AES-GCM', iv: un64(packet.iv)
	}, key, un64(packet.data))));
}
const recoveryKey = code => crypto.subtle.importKey('raw', bytes(code), {
	name: 'AES-GCM'
}, false, ['encrypt', 'decrypt']);
export async function connectClassroom({ role, code = '', recovery = '', sdk = null, onStatus = () => {
}, allowHidden = false } = {}) {
	sdk ??= await import(SDK);
	const debug = globalThis.historyTransportDebug = {
		sent: 0, received: 0, replied: 0, opened: 0, errors: []
	};
	let saved = null, pair, room, authority, teacherKey = '', session = crypto.randomUUID(), live = true, clock = Date.now(), last = performance.now(), peerKeys = new Map(), pending = new Map(), responses = new Map(), queue = Promise.resolve(), lastSave = 0, saveBusy = false;
	if (role === 'recover') {
		if (!/^[a-f0-9]{64}$/i.test(recovery))
			throw Error('Enter the full private recovery code');
		const record = localStorage.getItem('history.teacher.' + code.toUpperCase());
		if (!record)
			throw Error('No checkpoint in this browser. Recover here with the original browser profile, or create a new classroom.');
		saved = await open(await recoveryKey(recovery), JSON.parse(record));
		role = 'teacher';
	}
	const peerTokens = new Map(saved?.peerTokens || []);
	const teacher = role === 'teacher';
	pair = await keyPair(saved);
	const pub = b64(await crypto.subtle.exportKey('raw', pair.publicKey));
	if (teacher) {
		room = saved?.room;
		recovery ||= random();
		teacherKey = saved?.teacherKey || random();
	}
	else {
		code = code.trim().toUpperCase();
		if (!/^[A-Z0-9]+-[A-F0-9]{16}$/.test(code))
			throw Error('Use the full classroom code from your teacher');
		room = code.split('-')[0];
	}
	const url = new URL(location.href);
	url.hash = '';
	history.replaceState(null, '', url);
	let connectTimer;
	try {
		await Promise.race([sdk.insertCoin({
			gameId: GAME_ID, ...(room ? {
				roomCode: room
			} : {}), skipLobby: true, maxPlayersPerRoom: 40, reconnectGracePeriod: 30000
		}, undefined, () => {
			live = false;
			pause();
			onStatus('Disconnected. Teacher must reconnect; play is paused.');
		}), new Promise((_, reject) => {
			connectTimer = setTimeout(() => reject(Error('Playroom connection timed out. Check network access and free-plan limits.')), 20000);
		})]);
	}
	finally {
		clearTimeout(connectTimer);
	}
	room = sdk.getRoomCode();
	const me = sdk.myPlayer().id;
	if (teacher) {
		code = room + '-' + await fingerprint(pub);
		clock = saved?.clock || Date.now();
		const snapshot = saved?.snapshot;
		if (snapshot?.phase === 'active')
			snapshot.phase = 'paused';
		authority = createAuthority({
			classCode: code, teacherKey, snapshot, now: () => clock
		});
		sdk.setState('historyTeacher', {
			id: me, pub, session, code
		}, true);
	}
	let owner;
	if (!teacher) {
		for (let i = 0; i < 100; i++) {
			const candidate = sdk.getState('historyTeacher');
			if (candidate?.code === code && await fingerprint(candidate.pub) === code.split('-')[1]) {
				owner = candidate;
				break;
			}
			await sleep(100);
		}
		if (!owner)
			throw Error('Teacher not found. Check the classroom code and ask the teacher to keep the classroom open.');
		peerKeys.set(owner.pub, await shared(pair, owner.pub));
	}
	function pause() {
		if (!authority)
			return;
		try {
			if (authority.call('teacher/state', {}, teacherKey).phase === 'active')
				authority.call('teacher/pause', {}, teacherKey);
		}
		catch {
		}
	}
	async function checkpoint() {
		if (!teacher || saveBusy)
			return;
		saveBusy = true;
		try {
			const state = {
				room, pub, privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey), teacherKey, clock, peerTokens: [...peerTokens], snapshot: authority.exportSnapshot()
			};
			localStorage.setItem('history.teacher.' + code, JSON.stringify(await seal(await recoveryKey(recovery), state)));
		}
		finally {
			saveBusy = false;
		}
	}
	async function getKey(p) {
		if (!peerKeys.has(p))
			peerKeys.set(p, await shared(pair, p));
		return peerKeys.get(p);
	}
	const publish = (name, data) => {
		debug.sent++;
		const p = sdk.RPC.call(name, data, sdk.RPC.Mode.ALL);
		p?.catch?.(e => debug.errors.push('RPC ' + e.message));
	};
	sdk.RPC.register('historyRequest', async (packet, sender) => {
		debug.received++;
		if (!teacher || packet?.to !== pub || typeof packet.pub !== 'string')
			return null;
		queue = queue.then(async () => {
			try {
				const key = await getKey(packet.pub), request = await open(key, packet.body);
				if (request.room !== code || typeof request.id !== 'string' || request.id.length > 100)
					return;
				const cacheKey = sender.id + ':' + request.id;
				let reply = responses.get(cacheKey);
				if (!reply) {
					let result;
					try {
						if (request.route.startsWith('teacher/'))
							throw Error('Teacher commands are local to the classroom owner');
						if (!['join', 'state', 'select', 'move', 'setup', 'setup/begin', 'setup/swap', 'setup/shuffle', 'ack', 'battle/ready'].includes(request.route))
							throw Error('Unsupported student action');
						if (!live)
							throw Error('Teacher disconnected');
						if (performance.now() - last > 2500 || (!allowHidden && document.hidden))
							pause();
						result = authority.call(request.route, request.body, request.token || (request.route === 'join' ? peerTokens.get(packet.pub) : '') || '');
						if (request.route === 'join' && result.token)
							peerTokens.set(packet.pub, result.token);
					}
					catch (e) {
						result = {
							error: e.message
						};
					}
					reply = {
						to: packet.pub, from: pub, body: await seal(key, {
							id: request.id, result
						})
					};
					responses.set(cacheKey, reply);
					if (responses.size > 300)
						responses.delete(responses.keys().next().value);
				}
				publish('historyResponse', reply);
			}
			catch (e) {
				debug.errors.push('Request ' + e.message);
			} // Invalid ciphertext never reaches the authority.
		});
		await queue;
		return null;
	});
	sdk.RPC.register('historyResponse', async (packet) => {
		debug.replied++;
		if (teacher || packet?.to !== pub || packet.from !== owner.pub)
			return null;
		try {
			const response = await open(await getKey(owner.pub), packet.body);
			debug.opened++;
			const p = pending.get(response.id);
			if (p) {
				clearTimeout(p.timer);
				pending.delete(response.id);
				p.resolve(response.result);
			}
		}
		catch (e) {
			debug.errors.push('Response ' + e.message);
		}
		return null;
	});
	async function request(route, body = {}, token = '') {
		if (teacher) {
			if (!live)
				throw Error('Teacher disconnected');
			const result = authority.call(route, body, route.startsWith('teacher/') ? teacherKey : token);
			await checkpoint();
			return result;
		}
		const id = crypto.randomUUID(), bodyPacket = await seal(await getKey(owner.pub), {
			id, room: code, route, body, token
		});
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				pending.delete(id);
				reject(Error('Teacher unavailable — play is paused until the teacher returns.'));
			}, 6000);
			pending.set(id, {
				resolve, reject, timer
			});
			publish('historyRequest', {
				to: owner.pub, pub, body: bodyPacket
			});
		});
	}
	const visibility = () => {
		if (document.hidden) {
			pause();
			checkpoint();
		}
	};
	document.addEventListener('visibilitychange', visibility);
	const interval = setInterval(() => {
		const current = performance.now(), delta = current - last;
		last = current;
		if (teacher) {
			if (delta > 2500 || (!allowHidden && document.hidden) || !live)
				pause();
			else
				clock += delta;
			authority.tick();
			if (current - lastSave > 2000) {
				lastSave = current;
				checkpoint();
			}
		}
	}, 250);
	await checkpoint();
	onStatus(teacher ? 'Teacher classroom ready' : 'Connected to teacher');
	return {
		role: teacher ? 'teacher' : 'student', code, recovery, request, teacherKey, get authority() {
			return authority;
		}, pause, close() {
			clearInterval(interval);
			document.removeEventListener('visibilitychange', visibility);
			pause();
			checkpoint();
		}, async addComputer() {
			if (!teacher)
				throw Error('Teacher only');
			const { createOpponent } = await import('./npc.mjs');
			return createOpponent(authority, teacherKey, code);
		}
	};
}
