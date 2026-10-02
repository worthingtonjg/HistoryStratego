import test from 'node:test';
import assert from 'node:assert/strict';
import { connectClassroom, seal, open } from '../browser/transport.mjs';
function environment() {
	const store = new Map();
	globalThis.localStorage = {
		getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v)
	};
	globalThis.document = {
		hidden: false, addEventListener() {
		}, removeEventListener() {
		}
	};
	globalThis.location = {
		href: 'https://example.test/HistoryStratego/'
	};
	globalThis.history = {
		replaceState() {
		}
	};
	const state = {}, clients = [], packets = [];
	const sdk = id => {
		const callbacks = new Map(), client = {
			myPlayer: () => ({
				id
			}), getRoomCode: () => 'ROOM', insertCoin: async () => {
			}, setState: (k, v) => state[k] = v, getState: k => state[k], RPC: {
				Mode: {
					ALL: 0
				}, register: (n, f) => {
					callbacks.set(n, f);
					return () => callbacks.delete(n);
				}, call: async (n, p) => {
					packets.push({
						n, p
					});
					for (const c of clients)
						queueMicrotask(() => c.callbacks.get(n)?.(p, {
							id
						}));
				}
			}
		};
		clients.push({
			callbacks
		});
		return client;
	};
	return {
		sdk, packets, store
	};
}
test('browser authority encrypts student messages, retains redaction and rejects remote teacher control', async () => {
	const env = environment(), teacher = await connectClassroom({
		role: 'teacher', sdk: env.sdk('teacher')
	}), student = await connectClassroom({
		role: 'student', code: teacher.code, sdk: env.sdk('student')
	});
	try {
		const joined = await student.request('join', {
			classCode: teacher.code
		});
		assert(joined.token);
		assert.equal((await student.request('join', {
			classCode: teacher.code
		})).token, joined.token, 'retrying initial join does not duplicate the seat');
		assert(!JSON.stringify(env.packets).includes(joined.token));
		const denied = await student.request('teacher/start');
		assert.match(denied.error, /local/);
		teacher.pause();
		assert.equal((await student.request('state', {}, joined.token)).phase, 'waiting');
		assert.equal(student.role, 'student');
		assert(!JSON.stringify([...env.store.values()]).includes(joined.token));
	}
	finally {
		teacher.close();
		student.close();
	}
});
test('private recovery restores local checkpoint but rejects incorrect recovery credential', async () => {
	const env = environment(), teacher = await connectClassroom({
		role: 'teacher', sdk: env.sdk('teacher')
	});
	let recovered;
	try {
		const joined = await teacher.request('join', {
			classCode: teacher.code
		});
		await assert.rejects(connectClassroom({
			role: 'recover', code: teacher.code, recovery: '00'.repeat(32), sdk: env.sdk('bad')
		}));
		recovered = await connectClassroom({
			role: 'recover', code: teacher.code, recovery: teacher.recovery, sdk: env.sdk('recovered')
		});
		assert.equal(recovered.code, teacher.code);
		assert.equal((await recovered.request('state', {}, joined.token)).player, joined.player);
	}
	finally {
		teacher.close();
		recovered?.close();
	}
});
test('payload encryption rejects a different recipient key and tampering', async () => {
	const key = await crypto.subtle.generateKey({
		name: 'AES-GCM', length: 256
	}, false, ['encrypt', 'decrypt']), other = await crypto.subtle.generateKey({
		name: 'AES-GCM', length: 256
	}, false, ['encrypt', 'decrypt']);
	const p = await seal(key, {
		rank: '10'
	});
	assert.equal((await open(key, p)).rank, '10');
	await assert.rejects(open(other, p));
	p.data = 'AAAA' + p.data.slice(4);
	await assert.rejects(open(key, p));
});
test('two browser seats play through combat, pause and teacher recovery with redacted views', async () => {
	const env = environment(), teacher = await connectClassroom({
		role: 'teacher', sdk: env.sdk('teacher')
	}), one = await connectClassroom({
		role: 'student', code: teacher.code, sdk: env.sdk('one')
	}), two = await connectClassroom({
		role: 'student', code: teacher.code, sdk: env.sdk('two')
	});
	let recovered;
	try {
		const seats = await Promise.all([one, two].map(p => p.request('join', {
			classCode: teacher.code
		})));
		await teacher.request('teacher/start');
		const m = [...teacher.authority.matches.values()][0];
		m.phase = 'play';
		m.ready = [true, true];
		m.setupClocks = null;
		m.turnClock = null;
		m.board.fill(null);
		for (const [i, side, rank] of [[60, 0, '3'], [50, 1, 'B'], [99, 0, 'F'], [0, 1, 'F'], [1, 1, '2']])
			m.board[i] = {
				id: String(i), side, rank
			};
		const clients = [one, two], views = await Promise.all(clients.map((p, i) => p.request('state', {}, seats[i].token))), active = views.findIndex(v => v.match.side === 0), other = 1 - active;
		assert.equal(views[active].match.board[50].rank, '?');
		let result = await clients[active].request('move', {
			from: 60, to: 50, seq: m.seq, requestId: 'browser-combat'
		}, seats[active].token);
		assert(!result.error, result.error);
		assert.equal(result.match.battle.defender, 'B');
		const seq = m.seq;
		await clients[active].request('ack', {
			matchId: m.id, seq
		}, seats[active].token);
		await clients[other].request('ack', {
			matchId: m.id, seq
		}, seats[other].token);
		assert.equal(m.reveal, null);
		assert.equal(m.turn, 1);
		await teacher.request('teacher/pause');
		assert.equal((await one.request('state', {}, seats[0].token)).phase, 'paused');
		const denied = await two.request('move', {
			from: 1, to: 11, seq: m.seq, requestId: 'paused'
		}, seats[1].token);
		assert(denied.error);
		// Recovery in the original profile uses only the private locally encrypted checkpoint.
		recovered = await connectClassroom({
			role: 'recover', code: teacher.code, recovery: teacher.recovery, sdk: env.sdk('new-host-owner')
		});
		assert.equal((await recovered.request('state', {}, seats[0].token)).phase, 'paused');
		assert.equal(recovered.authority.matches.get(m.id).seq, seq);
	}
	finally {
		teacher.close();
		one.close();
		two.close();
		recovered?.close();
	}
});
