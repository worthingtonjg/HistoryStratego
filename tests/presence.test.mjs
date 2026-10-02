import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPresenceController, pinRoomInUrl } from '../web/playroom.mjs';
import { createAuthority } from '../server/server.mjs';
const snapshot = (phase = 'waiting') => ({
	phase, presence: {
		gameId: 'public-id', roomCode: 'AB12', sessionId: 'class-session'
	}
});
function harness(overrides = {}) {
	const calls = [], states = [];
	let disconnect;
	const sdk = {
		insertCoin: async (options, launch, onDisconnect) => {
			calls.push(options);
			disconnect = onDisconnect;
		}, getRoomCode: () => 'AB12'
	};
	const controller = createPresenceController({
		loadSDK: async () => sdk, status: s => states.push(s), pinRoom: () => {
		}, ...overrides
	});
	return {
		controller, calls, states, disconnect: () => disconnect()
	};
}
test('teacher/student snapshots share stable room across join, reload, rounds and end', () => {
	const a = createAuthority({
		timedSetup: false,
		teacherKey: 'key', classCode: 'CLASS'
	});
	const t = a.call('teacher/state', {}, 'key'), p = a.call('join', {
		classCode: 'CLASS', name: 'One'
	});
	assert.deepEqual(p.presence, t.presence);
	assert.match(p.presence.roomCode, /^[A-F0-9]{4}$/);
	assert.deepEqual(a.call('state', {}, p.token).presence, t.presence);
	a.call('join', {
		classCode: 'CLASS', name: 'Two'
	});
	a.call('teacher/start', {}, 'key');
	a.call('teacher/end', {}, 'key');
	assert.equal(a.call('state', {}, p.token).phase, 'ended');
	assert.deepEqual(a.call('state', {}, p.token).presence, t.presence);
	assert.throws(() => a.call('move', {
		from: 60, to: 50, seq: 0, requestId: 'revive', phase: 'active', isHost: true
	}, p.token), /teacher/);
	assert.throws(() => a.call('teacher/resume', {}, 'key'), /paused/);
});
test('automatic initial join is single-flight; polls do not duplicate SDK joins', async () => {
	const h = harness();
	await Promise.all([h.controller.sync(snapshot()), h.controller.sync(snapshot()), h.controller.sync(snapshot('active'))]);
	assert.equal(h.calls.length, 1);
	assert.equal(h.calls[0].roomCode, 'AB12');
	assert.equal(h.calls[0].skipLobby, true);
	assert.equal(h.calls[0].reconnectGracePeriod, 30000);
	assert.equal(h.states.at(-1).state, 'connected');
	assert(!JSON.stringify(h.calls).includes('token'));
});
test('reload reconnects to same room; disconnect is explicit fallback', async () => {
	const a = harness();
	await a.controller.sync(snapshot());
	a.disconnect();
	assert.equal(a.states.at(-1).state, 'disconnected');
	await a.controller.sync(snapshot());
	assert.equal(a.calls.length, 1);
	const b = harness();
	await b.controller.sync(snapshot());
	assert.equal(b.calls[0].roomCode, a.calls[0].roomCode);
});
test('ended snapshot never starts a join; only server-active snapshot enables it', async () => {
	const h = harness();
	await h.controller.sync(snapshot('ended'));
	assert.equal(h.calls.length, 0);
	assert.equal(h.states.at(-1).state, 'ended');
	await h.controller.sync(snapshot('active'));
	assert.equal(h.calls.length, 1);
	await h.controller.sync(snapshot('ended'));
	h.disconnect();
	assert.equal(h.states.at(-1).state, 'ended');
});
test('late connection completion cannot replace ended status', async () => {
	let finish;
	const states = [];
	const c = createPresenceController({
		loadSDK: async () => ({
			insertCoin: () => new Promise(r => finish = r), getRoomCode: () => 'AB12'
		}), pinRoom: () => {
		}, status: s => states.push(s)
	});
	const pending = c.sync(snapshot());
	await new Promise(r => setImmediate(r));
	await c.sync(snapshot('ended'));
	finish();
	await pending;
	assert.equal(states.at(-1).state, 'ended');
});
test('failed network and wrong-room responses visibly fall back without retry storm', async () => {
	for (const loadSDK of [async () => {
		throw Error('network');
	}, async () => ({
		insertCoin: async () => {
		}, getRoomCode: () => 'WRONG'
	})]) {
		const h = harness({
			loadSDK
		});
		await h.controller.sync(snapshot());
		assert.equal(h.states.at(-1).state, 'failed');
		assert.match(h.states.at(-1).text, /local server/);
		await h.controller.sync(snapshot());
		assert.equal(h.states.at(-1).state, 'failed');
	}
});
test('connection timeout produces fallback; late success recovers status', async () => {
	let finish;
	const states = [];
	const c = createPresenceController({
		loadSDK: async () => ({
			insertCoin: () => new Promise(r => finish = r), getRoomCode: () => 'AB12'
		}), pinRoom: () => {
		}, timeoutMs: 10, status: s => states.push(s)
	});
	const pending = c.sync(snapshot());
	await new Promise(r => setTimeout(r, 25));
	assert.equal(states.at(-1).state, 'failed');
	finish();
	await pending;
	assert.equal(states.at(-1).state, 'connected');
});
test('stale invite hash is cleared so roomCode cannot be overridden', () => {
	let result;
	pinRoomInUrl('AB12', {
		location: {
			href: 'http://localhost:8080/unity/index.html#r=EVIL'
		}, history: {
			replaceState: (a, b, u) => result = u.href
		}
	});
	assert.equal(result, 'http://localhost:8080/unity/index.html');
});
test('stable presence polling does not repeat live status announcements', async () => {
	const messages = [];
	let disconnected;
	const sdk = {
		getRoomCode: () => 'ROOM', insertCoin: async (_a, _b, onDisconnect) => {
			disconnected = onDisconnect;
		}
	};
	const p = createPresenceController({
		loadSDK: async () => sdk, pinRoom: () => {
		}, status: s => messages.push(s.text)
	});
	const snapshot = {
		phase: 'active', presence: {
			gameId: 'game', roomCode: 'ROOM', sessionId: 'session'
		}
	};
	await p.sync(snapshot);
	for (let i = 0; i < 20; i++)
		await p.sync(snapshot);
	assert.equal(messages.filter(t => t.startsWith('Playroom connected')).length, 1);
	disconnected();
	for (let i = 0; i < 10; i++)
		await p.sync(snapshot);
	assert.equal(messages.filter(t => t.startsWith('Playroom disconnected')).length, 1);
});
