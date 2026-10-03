import { acknowledge } from './game.mjs';
export const BATTLE_CONTINUE_MS = 3000;
export function armBattleContinue(m, side, seq, now) {
	const event = m.events.find(e => e.kind === 'combat' && e.seq === seq);
	if (!event)
		throw Error('Combat event not found');
	if (event.ack[side])
		return;
	if (m.events.find(e => e.kind === 'combat' && !e.ack[side]) !== event)
		throw Error('Review combat in order');
	m.continueClocks ??= [null, null];
	if (m.continueClocks[side]?.seq === seq)
		return;
	m.continueClocks[side] = {
		seq, remaining: BATTLE_CONTINUE_MS, at: now, eligible: false
	};
}
export function tickBattleContinue(m, phase, now) {
	for (let side = 0; side < 2; side++) {
		const c = m.continueClocks?.[side];
		if (!c)
			continue;
		const e = m.events.find(e => e.kind === 'combat' && e.seq === c.seq);
		if (!e || e.ack[side]) {
			m.continueClocks[side] = null;
			continue;
		}
		const elapsed = Math.max(0, now - c.at);
		c.at = now;
		if (phase !== 'active') {
			c.eligible = false;
			continue;
		}
		if (!c.eligible) {
			c.eligible = true;
			continue;
		}
		c.remaining = Math.max(0, c.remaining - elapsed);
		if (c.remaining === 0) {
			acknowledge(m, side, c.seq);
			m.continueClocks[side] = null;
		}
	}
}
export function battleContinueView(m, side) {
	const e = m.events.find(e => e.kind === 'combat' && !e.ack[side]), c = m.continueClocks?.[side];
	return {
		supported: true, seq: e?.seq ?? -1, armed: !!e && c?.seq === e.seq, remainingMs: e && c?.seq === e.seq ? c.remaining : BATTLE_CONTINUE_MS
	};
}
