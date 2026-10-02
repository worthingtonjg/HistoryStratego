export const PRESET_MESSAGES = Object.freeze({
	greeting: 'Greetings, General!', your_move: 'Your move, General.', bold: 'A bold maneuver!',
	trap: "You have fallen into my trap!", well_played: 'Well played!', good_game: 'Good game!'
});
export const EMOTE_COOLDOWN_MS = 10000, EMOTE_DISPLAY_MS = 4000;
export function sendPreset(records, match, side, id, now) {
	if (!Object.hasOwn(PRESET_MESSAGES, id))
		throw Error('Choose a preset message');
	if (side !== 0 && side !== 1)
		throw Error('Player membership required');
	const pair = records.get(match.id) || [null, null], previous = pair[side];
	if (previous && now - previous.at < EMOTE_COOLDOWN_MS)
		throw Error('Wait before sending another message');
	pair[side] = {
		id, at: now
	};
	records.set(match.id, pair);
}
export function presetView(records, match, side, now) {
	const pair = records.get(match.id) || [], own = pair[side];
	return {
		emotes: pair.flatMap((record, sender) => record && now - record.at < EMOTE_DISPLAY_MS && now >= record.at ? [{
			side: sender, text: PRESET_MESSAGES[record.id], issuedAt: record.at, remainingMs: EMOTE_DISPLAY_MS - (now - record.at)
		}] : []),
		emoteCooldownMs: own ? Math.max(0, EMOTE_COOLDOWN_MS - (now - own.at)) : 0
	};
}
