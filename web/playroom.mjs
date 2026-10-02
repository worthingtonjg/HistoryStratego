// Presence only: never send credentials, ranks, or authoritative game state here.
export const SDK_URL = 'https://esm.sh/playroomkit@0.0.97?bundle';
export function pinRoomInUrl(roomCode, win = globalThis.window) {
	if (!win)
		return;
	// Playroom gives #r= priority over roomCode. Clear stale invite-room fragments; let the documented roomCode option select the room.
	const url = new URL(win.location.href);
	url.hash = '';
	win.history.replaceState(null, '', url);
}
export function createPresenceController({ loadSDK = () => import(SDK_URL), status = () => {
}, pinRoom = pinRoomInUrl, timeoutMs = 15000 } = {}) {
	let config = null, phase = 'waiting', state = 'idle', attempt = null, timer = null, lastText = null;
	const emit = () => {
		const room = config?.roomCode || '';
		const text = phase === 'ended' ? 'Round ended. Play remains disabled until the teacher starts a new round.' :
			state === 'connected' ? 'Playroom connected | classroom room ' + room :
				state === 'connecting' ? 'Connecting classroom presence...' :
					state === 'failed' ? 'Playroom unavailable. Classroom controls and moves still use the local server. Reload to reconnect.' :
						state === 'disconnected' ? 'Playroom disconnected. Classroom controls and moves still use the local server. Reload to reconnect.' :
							'Join the classroom to connect presence automatically.';
		if (text === lastText)
			return;
		lastText = text;
		status({
			state: phase === 'ended' ? 'ended' : state, text, roomCode: room
		});
	};
	function connect() {
		state = 'connecting';
		emit();
		timer = setTimeout(() => {
			if (state === 'connecting') {
				state = 'failed';
				emit();
			}
		}, timeoutMs);
		attempt = (async () => {
			try {
				const sdk = await loadSDK();
				pinRoom(config.roomCode);
				await sdk.insertCoin({
					gameId: config.gameId, roomCode: config.roomCode, skipLobby: true, maxPlayersPerRoom: 40, reconnectGracePeriod: 30000
				}, undefined, () => {
					state = 'disconnected';
					emit();
				});
				if (sdk.getRoomCode() !== config.roomCode)
					throw Error('Unexpected Playroom room');
				state = 'connected';
				emit();
			}
			catch {
				state = 'failed';
				emit();
			}
			finally {
				clearTimeout(timer);
			}
		})();
		return attempt;
	}
	return {
		sync(snapshot) {
			phase = snapshot.phase;
			const incoming = snapshot.presence;
			if (!incoming?.gameId || !incoming?.roomCode) {
				emit();
				return Promise.resolve();
			}
			if (config && config.sessionId !== incoming.sessionId) {
				state = 'failed';
				emit();
				return Promise.resolve();
			}
			config = incoming;
			if (phase === 'ended') {
				emit();
				return Promise.resolve();
			}
			if (state === 'idle')
				return connect();
			emit();
			return attempt || Promise.resolve();
		}, getState: () => ({
			state, phase, roomCode: config?.roomCode
		})
	};
}
let unityController;
export function syncUnityPresence(snapshot, status) {
	if (!unityController)
		unityController = createPresenceController({
			status: s => status(s.text)
		});
	return unityController.sync(snapshot);
}
