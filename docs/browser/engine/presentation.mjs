import { view } from './game.mjs';
// Teacher choices are presentation preferences, separate from match/rules state.
export function installPresentation(authority) {
	const original = authority.__baseCall ??= authority.call.bind(authority), choices = authority.__perspectiveChoices ??= new Map(), nameCache = authority.__nameCache ??= new Map();
	const names = m => {
		const values = m.playerNames ??= m.players.map(id => authority.students.get(id)?.name || 'Player');
		nameCache.set(m.id, values);
		return values;
	};
	for (const m of authority.matches.values())
		names(m);
	authority.call = function (route, b = {}, token = '') {
		const result = original(route, b, token); // Always performs existing authentication/authorization first.
		const m = result.match && authority.matches.get(result.match.id);
		if (route === 'teacher/spectate' && m) {
			if (b.perspective) {
				if (!['red', 'blue'].includes(b.perspective))
					throw Error('Choose red or blue');
				choices.set(m.id, b.perspective === 'red' ? 0 : 1);
			}
			const side = choices.get(m.id) ?? 0, snapshot = view(m, side, {
				spectator: true
			});
			// Movement never reveals the unselected army's ranks; combat still reveals both participants.
			snapshot.events = snapshot.events.map(e => e.kind === 'combat' || e.side === side ? e : {
				...e, moving: '?'
			});
			return {
				...result, perspectiveName: names(m)[side], match: {
					...snapshot, ...authority.clockView?.(m), playerNames: names(m), commanders: m.commanders || []
				}
			};
		}
		if (m)
			return {
				...result, match: {
					...result.match, playerNames: names(m)
				}
			};
		if (result.match && nameCache.has(result.match.id))
			return {
				...result, match: {
					...result.match, playerNames: nameCache.get(result.match.id)
				}
			};
		return result;
	};
	return authority;
}
