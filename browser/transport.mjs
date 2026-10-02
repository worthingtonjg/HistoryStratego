import { requireTeacherAccess } from './teacher-access.mjs';
import { isRetired, rememberClassroom, retireClassroom, retiredRoom } from './classroom-memory.mjs';
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
}, allowHidden = false, teacherAccess = null } = {}) {
	if (role === 'teacher' || role === 'recover')
		requireTeacherAccess(teacherAccess);
	if (code && isRetired(code.trim().toUpperCase()))
		throw Error('Class ended. Ask for the new classroom code.');
	sdk ??= await import(SDK);
	const debug = globalThis.historyTransportDebug = {
		sent: 0, received: 0, replied: 0, opened: 0, errors: []
	};
	let saved = null, pair, room, authority, teacherKey = '', session = crypto.randomUUID(), live = true, clock = Date.now(), last = performance.now(), peerKeys = new Map(), pending = new Map(), responses = new Map(), queue = Promise.resolve(), lastSave = 0, savePromise = Promise.resolve();
	if (role === 'recover') {
		if (!/^[a-f0-9]{64}$/i.test(recovery))
			throw Error('Enter the full private recovery code');
		const record = localStorage.getItem('history.teacher.' + code.toUpperCase());
		if (!record)
			throw Error('No checkpoint in this browser. Recover here with the original browser profile, or create a new classroom.');
		saved = await open(await recoveryKey(recovery), JSON.parse(record));
		if (saved.retired)
			throw Error('Class ended. This classroom was retired.');
		role = 'teacher';
	}
	const peerTokens = new Map(saved?.peerTokens || []), botTokens = new Set(saved?.botTokens || []), bots = new Map();
	let retired = false, closed = false, shortJoin = false, requestedRoom = "";
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
		shortJoin = /^[A-Z0-9]{4}$/.test(code);
		if (!shortJoin && !/^[A-Z0-9]+-[A-F0-9]{16}$/.test(code))
			throw Error('Enter the four-character classroom code from your teacher.');
		room = code.split('-')[0];
		requestedRoom = room;
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
	if (!teacher && room !== requestedRoom)
		throw Error('Connected to a different room. Reload and enter the classroom code again.');
	if (teacher && !saved && (retiredRoom(room) || sdk.getState('historyTeacher') || (typeof sdk.isHost === 'function' && !sdk.isHost())))
		throw Error('That room is already owned or was retired here. Reload the teacher page to create a fresh classroom.');
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
			const candidateMatches = candidate?.code && (shortJoin ? candidate.code.split('-')[0] === requestedRoom : candidate.code === code);
			if (candidateMatches && candidate.retired)
				throw Error('Class ended. Ask for the new classroom code.');
			if (candidateMatches && await fingerprint(candidate.pub) === candidate.code.split('-')[1]) {
				code = candidate.code; // First-join trust for short codes; retain full identity for subsequent reconnects.
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
		if (!teacher)
			return;
		// Serialize writes so a concurrent polling save cannot overwrite retirement or NPC seats.
		savePromise = savePromise.catch(() => {
		}).then(async () => {
			const state = {
				retired, botTokens: [...botTokens], room, pub, privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey), teacherKey, clock, peerTokens: [...peerTokens], snapshot: authority.exportSnapshot()
			};
			localStorage.setItem('history.teacher.' + code, JSON.stringify(await seal(await recoveryKey(recovery), state)));
		});
		return savePromise;
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
		return p;
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
				if (isRetired(code))
					retired = true;
				if (retired) {
					publish('historyResponse', {
						to: packet.pub, from: pub, body: await seal(key, {
							id: request.id, result: endedResult(request.route)
						})
					});
					return;
				}
				let reply = responses.get(cacheKey);
				if (!reply) {
					let result;
					try {
						if (request.route.startsWith('teacher/'))
							throw Error('Teacher commands are local to the classroom owner');
						if (!['join', 'state', 'select', 'move', 'setup', 'setup/begin', 'setup/swap', 'setup/shuffle', 'ack', 'battle/ready'].includes(request.route))
							throw Error('Unsupported student action');
						if (!live || closed)
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
	function endedResult(route) {
		return route === 'state' ? {
			classCode: code, phase: 'ended', match: null, paired: false
		} : {
			error: 'Class ended. Ask for the new classroom code.'
		};
	}
	sdk.RPC.register('historyClassEnded', async (packet) => {
		if (teacher || packet?.to !== pub || packet.from !== owner.pub)
			return;
		try {
			const message = await open(await getKey(owner.pub), packet.body);
			if (message.code === code && message.retired) {
				retired = true;
				onStatus('Class ended. Ask your teacher for the new classroom code.');
			}
		}
		catch {
		}
	});
	async function request(route, body = {}, token = '') {
		if (retired || isRetired(code))
			return endedResult(route);
		if (closed)
			throw Error('Connection closed. Reload to reconnect.');
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
			if (isRetired(code) && !retired) {
				retired = true;
				authority.call('teacher/end', {}, teacherKey);
				for (const bot of bots.values())
					bot.stop();
				bots.clear();
			}
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
	if (teacher) {
		rememberClassroom(code, recovery);
		if (botTokens.size) {
			const { createOpponent } = await import('./npc.mjs');
			for (const token of botTokens)
				bots.set(token, createOpponent(authority, teacherKey, code, token));
		}
	}
	await checkpoint();
	onStatus(teacher ? 'Teacher classroom ready' : 'Connected to teacher');
	return {
		role: teacher ? 'teacher' : 'student', code, joinCode: room, recovery, request, teacherKey, get authority() {
			return authority;
		}, pause, async retire() {
			if (!teacher)
				throw Error('Teacher only');
			if (retired)
				return;
			authority.call('teacher/end', {}, teacherKey);
			retired = true;
			retireClassroom(code);
			responses.clear();
			for (const bot of bots.values())
				bot.stop();
			bots.clear();
			sdk.setState('historyTeacher', {
				id: me, pub, session, code, retired: true
			}, true);
			await checkpoint();
			const notices = [...peerKeys.keys()].map(async (peer) => publish('historyClassEnded', {
				to: peer, from: pub, body: await seal(await getKey(peer), {
					code, retired: true
				})
			}));
			// Give reliable RPC delivery a bounded opportunity before the teacher page leaves.
			await Promise.race([Promise.allSettled(notices), sleep(700)]);
			onStatus('Class ended. The old code cannot resume play.');
		}, pause, close() {
			closed = true;
			for (const bot of bots.values())
				bot.stop();
			bots.clear();
			clearInterval(interval);
			document.removeEventListener('visibilitychange', visibility);
			pause();
			checkpoint();
		}, async addComputer() {
			if (!teacher)
				throw Error('Teacher only');
			const { createOpponent } = await import('./npc.mjs');
			if (retired || isRetired(code))
				throw Error('Class ended');
			const bot = createOpponent(authority, teacherKey, code);
			bots.set(bot.token, bot);
			botTokens.add(bot.token);
			await checkpoint();
			return {
				name: bot.name
			};
		}
	};
}
