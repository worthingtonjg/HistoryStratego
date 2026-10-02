// Public combat + public movement only. Enemy board ranks are deliberately never read.
export function observeRanks(m, prior) {
	const valid = prior?.matchId === m.id && prior?.side === m.side && prior?.lastSeq <= m.seq;
	const events = (m.events || []).filter(e => ['move', 'combat'].includes(e.kind)).sort((a, b) => a.seq - b.seq);
	const k = valid ? structuredClone(prior) : {
		matchId: m.id, side: m.side, lastSeq: (events[0]?.seq ?? m.seq + 1) - 1, pieces: {}
	};
	const at = square => Object.entries(k.pieces).find(([, p]) => p.square === square);
	const erase = square => {
		const p = at(square);
		if (p)
			delete k.pieces[p[0]];
	};
	for (const e of events.filter(e => e.seq > k.lastSeq)) {
		if (e.seq !== k.lastSeq + 1)
			k.pieces = {}; // Missing moves make identity ambiguous.
		const moving = e.side !== m.side ? at(e.from) : null;
		if (e.side !== m.side)
			erase(e.from);
		if (e.kind === 'combat') {
			if (e.side === m.side) {
				const old = at(e.to);
				erase(e.to);
				if (e.outcome < 0)
					k.pieces[old?.[0] || 'reveal-' + e.seq] = {
						square: e.to, rank: e.defender, seenSeq: e.seq
					};
			}
			else {
				erase(e.to);
				if (e.outcome > 0)
					k.pieces[moving?.[0] || 'reveal-' + e.seq] = {
						square: e.to, rank: e.attacker, seenSeq: e.seq
					};
			}
		}
		else {
			erase(e.to);
			if (moving)
				k.pieces[moving[0]] = {
					...moving[1], square: e.to
				};
		}
		k.lastSeq = e.seq;
	}
	if (k.lastSeq < m.seq)
		k.pieces = {};
	k.lastSeq = m.seq;
	for (const [id, p] of Object.entries(k.pieces))
		if (m.board[p.square]?.side !== 1 - m.side)
			delete k.pieces[id];
	return k;
}
export function knownOutcome(attacker, defender) {
	if (!defender)
		return null;
	if (defender === 'F')
		return 1;
	if (defender === 'B')
		return attacker === '3' ? 1 : -1;
	if (attacker === '1' && defender === '10')
		return 1;
	return Math.sign(Number(attacker) - Number(defender));
}
