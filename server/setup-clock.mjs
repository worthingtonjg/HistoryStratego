import { setup } from './game.mjs';
import { flagFormation, fillFormation, shuffleRemaining } from '../web/formation.mjs';
export const SETUP_MS = 300000;
export function initSetup(m) {
	m.setupClocks = [0, 1].map(() => ({
		started: false, deadline: null, remaining: SETUP_MS, revision: 0, stage: 1, draft: flagFormation(), automatic: false
	}));
}
export function tickSetup(m, phase, now) {
	for (const c of m.setupClocks || []) {
		if (phase === 'active' && c.noticeRemaining > 0)
			c.noticeRemaining = Math.max(0, c.noticeRemaining - Math.max(0, now - c.noticeAt));
		c.noticeAt = now;
	}
	if (phase !== 'active' || m.phase !== 'setup' || m.setupCancelled || !m.setupClocks)
		return;
	for (let side = 0; side < 2; side++) {
		const c = m.setupClocks[side];
		if (!m.ready[side] && c.started && c.deadline !== null && now >= c.deadline) {
			c.draft = fillFormation(c.draft);
			c.stage = 3;
			c.revision++;
			setup(m, side, c.draft);
			c.automatic = true;
			c.noticeRemaining = 3000;
			c.noticeAt = now;
			c.remaining = 0;
			c.deadline = null;
		}
	}
}
export function pauseSetup(m, now) {
	for (const c of m.setupClocks || [])
		if (c.deadline !== null) {
			c.remaining = Math.max(0, c.deadline - now);
			c.deadline = null;
		}
}
export function resumeSetup(m, now) {
	if (m.phase !== 'setup' || m.setupCancelled)
		return;
	for (let side = 0; side < 2; side++) {
		const c = m.setupClocks?.[side];
		if (c?.started && !m.ready[side])
			c.deadline = now + c.remaining;
	}
}
export function setupView(m, side, phase, now) {
	const c = m.setupClocks?.[side];
	if (!c)
		return null;
	return {
		stage: c.stage ?? 3, noticeRemainingMs: c.noticeRemaining || 0, enabled: true, started: c.started, remainingMs: m.ready[side] || phase === 'ended' ? 0 : c.deadline === null ? c.remaining : Math.max(0, c.deadline - now), serverNow: now, deadline: c.deadline || 0, revision: c.revision, draft: m.phase === 'setup' && !m.ready[side] ? [...c.draft] : [], automatic: c.automatic
	};
}
export function setupAction(m, side, route, b, now) {
	if (b.matchId !== m.id)
		throw Error('Setup belongs to a different round');
	tickSetup(m, 'active', now);
	const c = m.setupClocks[side];
	if (route === 'setup/begin' && c.started)
		return;
	if (route === 'setup' && m.ready[side])
		return;
	if (m.phase !== 'setup' || m.ready[side] || m.setupCancelled)
		throw Error('Setup is locked');
	if (route === 'setup/begin') {
		c.started = true;
		c.deadline = now + SETUP_MS;
		return;
	}
	if (!c.started)
		throw Error('Read the matchup and choose Start game first');
	if (b.revision !== c.revision)
		throw Error('Formation changed; use the refreshed layout');
	if (route === 'setup/next') {
		const stage=c.stage??3;
		if(stage>=3)throw Error('Formation already at final phase');
		c.stage=stage+1;
		c.draft=fillFormation(c.draft,c.stage);
		c.revision++;
	}
	else if (route === 'setup/swap') {
		if (!Number.isInteger(b.from) || !Number.isInteger(b.to) || b.from < 0 || b.from >= 40 || b.to < 0 || b.to >= 40 || b.from === b.to)
			throw Error('Choose two different formation pieces');
		if (!c.draft[b.from] && !c.draft[b.to]) throw Error('Choose a placed piece first');
		[c.draft[b.from], c.draft[b.to]] = [c.draft[b.to], c.draft[b.from]];
		c.revision++;
	}
	else if (route === 'setup/shuffle') {
		if((c.stage??3)!==3)throw Error('Advance through Flag and Bombs first');
		c.draft = shuffleRemaining(c.draft);
		c.revision++;
	}
	else if (route === 'setup') {
		if((c.stage??3)!==3)throw Error('Complete all three formation phases before Ready');
		setup(m, side, c.draft);
		c.deadline = null;
		c.remaining = 0;
	}
	else
		throw Error('Unknown setup action');
}
