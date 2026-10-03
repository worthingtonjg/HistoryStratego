import { view, legal, move } from './game.mjs';
import { planDemoMoves } from './demo-policy.mjs';
export const TURN_MS = 30000, ANNOUNCE_MS = 3000, TURN_BANNER_MS = 2000;
export const setupBlocked = m => (m.setupClocks || []).some(c => c.noticeRemaining > 0);
export function initTurn(m) {
	m.turnClock = null;
	m.timeoutMemory = [null, null];
	m.timedTurns = true;
}
export function turnView(m, now) {
	const c = m.turnClock;
	return m.timedTurns ? {
		enabled: true, side: m.turn, seq: m.seq, remainingMs: c?.remaining ?? TURN_MS, noticeRemainingMs: c?.notice ?? 0, bannerRemainingMs: c?.banner ?? TURN_BANNER_MS, serverNow: now
	} : null;
}
export function tickTurn(m, phase, now, npc = false) {
	if (!m.timedTurns)
		return;
	let c = m.turnClock;
	const eligible = phase === 'active' && m.phase === 'play' && !setupBlocked(m) && !m.reveal && !m.events.some(e => e.kind === 'combat' && !e.ack[m.turn]);
	if (!c || c.seq !== m.seq)
		c = m.turnClock = {
			seq: m.seq, remaining: TURN_MS, banner: TURN_BANNER_MS, notice: 0, at: now, eligible: false
		};
	let elapsed = Math.max(0, now - c.at);
	c.at = now;
	if (!eligible) {
		c.eligible = false;
		return;
	}
	if (!c.eligible) {
		c.eligible = true;
		return;
	}
	// Stage boundaries never backdate an unseen announcement after a delayed tick.
	if (c.banner > 0) {
		const used = Math.min(c.banner, elapsed);
		c.banner -= used;
		elapsed -= used;
		if (c.banner > 0 || elapsed === 0)
			return;
	}
	if (c.remaining > 0) {
		c.remaining = Math.max(0, c.remaining - elapsed);
		if (c.remaining === 0) {
			c.notice = ANNOUNCE_MS;
			m.selection = null;
		}
		return;
	}
	c.notice = Math.max(0, c.notice - elapsed);
	if (c.notice > 0)
		return;
	const side = m.turn;
	// Policy sees exactly the participant projection, never the authoritative board.
	const plan = planDemoMoves(view(m, side), m.timeoutMemory[side], { restrictMinerAttacks: npc, restrictMarshalAttacks: npc });
	m.timeoutMemory[side] = plan.memory;
	const choice = [...plan.candidates, ...plan.fallback, ...plan.emergency].find(p => legal(m, side, p.from, p.to));
	if (!choice) {
		// Classic no-legal-move defeat, never a fabricated skipped turn.
		const any = m.board.some((p, from) => p?.side === side && Array.from({
			length: 100
		}, (_, to) => to).some(to => legal(m, side, from, to)));
		if (any && npc) {
			// A policy hold is not defeat or permission to violate the NPC attack whitelist.
			c.remaining = TURN_MS; c.notice = 0; c.banner = 0;
			return;
		}
		if (any)
			throw Error('Timeout policy failed to enumerate a legal move');
		m.phase = 'over';
		m.winner = 1 - side;
		m.selection = null;
		m.events.push({
			seq: m.seq, text: 'No legal moves remain.'
		});
		return;
	}
	move(m, side, choice.from, choice.to, m.seq, 'timeout-' + m.seq);
	const event = m.events.find(e => e.seq === m.seq && ['move', 'combat'].includes(e.kind));
	if (event)
		event.automatic = true;
	tickTurn(m, phase, now, npc);
}
export function checkTurnGate(m) {
	if (setupBlocked(m))
		throw Error('Wait for the setup timeout notice');
	if (m.turnClock?.notice > 0)
		throw Error('Automatic turn is being announced');
}
