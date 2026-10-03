import { synchronize } from './demo-policy.mjs';
import { randomInt, randomUUID } from './random.mjs';
export const COUNTS = {
	F: 1, B: 6, 1: 1, 2: 8, 3: 5, 4: 4, 5: 4, 6: 4, 7: 3, 8: 2, 9: 1, 10: 1
};
export const NAMES = {
	F: 'Flag', B: 'Bomb', 1: 'Spy', 2: 'Scout', 3: 'Miner', 4: 'Sergeant', 5: 'Lieutenant', 6: 'Captain', 7: 'Major', 8: 'Colonel', 9: 'General', 10: 'Marshal'
};
export const lake = i => [42, 43, 46, 47, 52, 53, 56, 57].includes(i);
export const army = () => Object.entries(COUNTS).flatMap(([r, n]) => Array(n).fill(r));
export function shuffle(a) {
	a = [...a];
	for (let i = a.length - 1; i > 0; i--) {
		let j = randomInt(i + 1);
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}
const check = (ok, msg) => {
	if (!ok)
		throw Error(msg);
};
export function createMatch(players) {
	return {
		id: randomUUID(), players, board: Array(100).fill(null), ready: [false, false], phase: 'setup', turn: 0, seq: 0, winner: -1, history: [[], []], captures: [0, 0], events: [], selection: null, reveal: null, recovery: [], requests: new Map()
	};
}
// Legacy checkpoints predate counters. Both ready armies began with exactly 40
// pieces (enforced by setup); combat is the only operation removing pieces.
export function captureTotals(m) {
 if (Array.isArray(m.captures) && m.captures.length === 2) return [...m.captures];
 if (!m.ready?.every(Boolean)) return [0, 0];
 return [0, 1].map(side => 40 - m.board.filter(p => p?.side === 1 - side).length);
}
// Combat count is bounded by the original 80 pieces: every combat removes at least one.
// Keep these records independently of the rolling display so delayed review, tips and banter survive.
export function combatEvents(m) {
 const records = new Map((m.combats || []).map(e => [e.seq, e]));
 for (const e of m.events || []) if (e.kind === 'combat' && !records.has(e.seq)) records.set(e.seq,e);
 m.combats = [...records.values()].sort((a,b)=>a.seq-b.seq);
 for (let i=0;i<(m.events || []).length;i++) if(m.events[i].kind==='combat') m.events[i]=records.get(m.events[i].seq);
 if(m.reveal) m.reveal=records.get(m.reveal.seq) || m.reveal;
 return m.combats;
}
export function compactHistory(m) {
 if(m.archiveSummary) return m;
 combatEvents(m);
 m.decisionMemory ??= [null,null];
 for(const side of [0,1]) {
  // Only a redacted projection enters the observation reducer. Seed legacy timeout memory before trimming.
  const prior=m.decisionMemory[side] || m.timeoutMemory?.[side];
  m.decisionMemory[side]=!prior || prior.lastSeq!==m.seq || !prior.recentMoves || !prior.hunters ? synchronize(view(m,side,{skipHistory:true}),prior) : prior;
 }
 m.outcomeReason ||= m.events.some(e=>e.text==='No legal moves remain.') ? 'no-legal-moves' : m.combats.some(e=>e.defender==='F' && e.outcome>0) ? 'flag' : '';
 const moves=m.events.filter(e=>['move','combat'].includes(e.kind));
 const start=moves.length>20 ? moves.at(-20).seq : -Infinity;
 m.events=m.events.filter(e=>e.seq>=start);
 m.historyVersion=1;
 while(m.requests.size>128) m.requests.delete(m.requests.keys().next().value);
 return m;
}
export function setup(m, side, ranks) {
	check(m.phase === 'setup' && !m.ready[side], 'Setup is locked');
	check(Array.isArray(ranks) && ranks.length === 40, 'Place all 40 pieces');
	check(Object.entries(COUNTS).every(([r, n]) => ranks.filter(x => x === r).length === n), 'Invalid army counts');
	for (let j = 0; j < 40; j++) {
		const i = side === 0 ? 60 + j : 39 - j;
		m.board[i] = {
			id: randomUUID(), side, rank: ranks[j]
		};
	}
	m.ready[side] = true;
	m.seq++;
	if (m.ready.every(Boolean))
		m.phase = 'play';
}
export function legal(m, side, from, to) {
	if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > 99 || to < 0 || to > 99 || from === to || lake(to))
		return false;
	const p = m.board[from], q = m.board[to];
	if (!p || p.side !== side || p.rank === 'B' || p.rank === 'F' || q?.side === side)
		return false;
	const fx = from % 10, fy = Math.floor(from / 10), tx = to % 10, ty = Math.floor(to / 10);
	if (fx !== tx && fy !== ty)
		return false;
	const dist = Math.abs(fx - tx) + Math.abs(fy - ty);
	if (p.rank !== '2' && dist !== 1)
		return false;
	const step = fx === tx ? Math.sign(to - from) * 10 : Math.sign(to - from);
	for (let i = from + step; i !== to; i += step)
		if (lake(i) || m.board[i])
			return false;
	return true;
}
export function resolve(a, d) {
	if (d === 'F')
		return 1;
	if (d === 'B')
		return a === '3' ? 1 : -1;
	if (a === '1' && d === '10')
		return 1;
	return Math.sign(Number(a) - Number(d));
}
export function move(m, side, from, to, seq, requestId) {
	compactHistory(m);
	check(typeof requestId === 'string' && requestId.length > 0 && requestId.length < 100, 'Request ID required');
	const key = side + ':' + requestId;
	if (m.requests.has(key)) {
		check(m.requests.get(key) === JSON.stringify([from, to, seq]), 'Request ID reused');
		return;
	}
	check(!combatEvents(m).some(e => e.kind === 'combat' && !e.ack[side]), 'Review your pending combat first');
	check(!m.reveal, 'Both players must acknowledge combat');
	check(m.phase === 'play', 'Match is not active');
	check(seq === m.seq, 'Stale position: refresh and retry');
	check(m.turn === side, 'Wait for your turn');
	check(legal(m, side, from, to), 'Illegal move');
	const p = m.board[from], q = m.board[to], targets = destinations(m, side, from);
	m.captures ??= captureTotals(m);
	m.board[from] = null;
	m.selection = null;
	if (q) {
		const outcome = resolve(p.rank, q.rank);
		if (outcome >= 0) m.captures[side]++;
		if (outcome <= 0) m.captures[1 - side]++;
		m.events.push({
			kind: 'combat', side, outcome, ack: [false, false], released: [false, false], targets, moving: p.rank, seq: m.seq + 1, text: NAMES[p.rank] + ' attacks ' + NAMES[q.rank] + ': ' + (outcome === 0 ? 'both removed' : outcome > 0 ? 'attacker wins' : 'defender holds'), from, to, attacker: p.rank, defender: q.rank
		});
		m.board[to] = outcome > 0 ? p : outcome === 0 ? null : q;
		if (q.rank === 'F') {
			m.winner = side;
			m.phase = 'over';
		}
	}
	else {
		m.board[to] = p;
		m.events.push({
			kind: 'move', side, targets, moving: p.rank, seq: m.seq + 1, text: (p.rank === '2' && Math.abs(to - from) !== 1 && Math.abs(to - from) !== 10 ? 'Scout' : 'Piece') + ' moves', from, to
		});
	}
	if (q)
		m.reveal = m.events.at(-1);
	m.history[side].push({
		id: p.id, from, to
	});
	m.history[side] = m.history[side].slice(-2);
	m.turn = 1 - side;
	m.seq++;
	m.requests.set(key, JSON.stringify([from, to, seq]));
	if (m.phase === 'play' && !m.board.some((piece, i) => piece?.side === m.turn && Array.from({
		length: 100
	}, (_, j) => j).some(j => legal(m, m.turn, i, j)))) {
		m.phase = 'over';
		m.winner = side;
		m.events.push({
			seq: m.seq, text: 'No legal moves remain.'
		});
	}
	compactHistory(m);
}
export function destinations(m, side, from) {
	return Array.from({
		length: 100
	}, (_, to) => to).filter(to => legal(m, side, from, to)).map(to => ({
		to, attack: !!m.board[to]
	}));
}
const selectionCache = new WeakMap();
// Reuse the authoritative movement rules once per position. No enemy ranks leave view().
export function selectionOptions(m, side) {
 if (m.phase !== 'play' || m.archived || m.reveal || m.turn !== side || combatEvents(m).some(e => e.kind === 'combat' && !e.ack[side])) return [];
 let cached = selectionCache.get(m);
 if (!cached || cached.seq !== m.seq || cached.side !== side) {
  const options = [];
  for (let from = 0; from < 100; from++) {
   const p = m.board[from];
   if (p?.side === side && p.rank !== 'B' && p.rank !== 'F') options.push({from,side,seq:m.seq,targets:destinations(m,side,from)});
  }
  cached = {seq:m.seq,side,options}; selectionCache.set(m,cached);
 }
 return cached.options;
}
export function select(m, side, from, seq) {
	check(!combatEvents(m).some(e => e.kind === 'combat' && !e.ack[side]), 'Review your pending combat first');
	check(!m.reveal && m.phase === 'play' && m.turn === side, 'Selection is unavailable');
	check(seq === m.seq, 'Stale selection');
	check(Number.isInteger(from) && m.board[from]?.side === side && !['B', 'F'].includes(m.board[from].rank), 'Select your movable piece');
	m.selection = {
		from, side, seq, targets: destinations(m, side, from)
	};
}
export function acknowledge(m, side, seq) {
	const event = combatEvents(m).find(e => e.seq === seq && e.kind === 'combat');
	check(event, 'Combat event not found');
	const older = combatEvents(m).find(e => e.kind === 'combat' && !e.ack[side]);
	check(event.ack[side] || older === event, 'Acknowledge combat in order');
	event.ack[side] = true;
	if (m.reveal === event && event.ack.every((v, i) => v || event.released[i]))
		m.reveal = null;
}
export function releaseReveal(m, side, seq) {
	check(side === 0 || side === 1, 'Choose the absent side');
	check(m.reveal?.seq === seq, 'No matching pending combat');
	m.reveal.released[side] = true;
	m.recovery.push({
		seq, side, action: 'Teacher released absent player barrier'
	});
	if (m.reveal.ack.every((v, i) => v || m.reveal.released[i]))
		m.reveal = null;
}
export function view(m, side, { spectator = false, skipHistory = false } = {}) {
	if(!skipHistory && (!m.historyVersion || m.decisionMemory?.some(mem=>mem?.lastSeq!==m.seq))) m=compactHistory(structuredClone(m));
	const battle = spectator ? m.reveal : combatEvents(m).find(e => e.kind === 'combat' && !e.ack[side]) || m.reveal;
	return {
		compactHistory: !skipHistory, lastOwnSquare: m.board.findIndex(p=>p && p.side===side && p.id===m.history[side]?.at(-1)?.id),
        outcomeReason:m.outcomeReason || '', combatHistory:combatEvents(m).map(({seq,kind,side,from,to,attacker,defender,outcome,text})=>({seq,kind,side,from,to,attacker,defender,outcome,text})),
        decisionMemory:skipHistory ? undefined : structuredClone(m.decisionMemory?.[side] || null),
		id: m.id, phase: m.archived ? 'over' : m.phase, turn: m.turn, seq: m.seq, winner: m.winner, side, ready: m.ready, blocked: !!m.reveal, battle: battle ? {
			...battle
		} : null, selection: m.selection && (spectator || side === m.turn) ? m.selection : null, selectionOptions: spectator ? [] : selectionOptions(m, side), board: m.board.map(p => p ? {
			side: p.side, rank: p.side === side ? p.rank : '?'
		} : null), events: m.events.map(e => ({
			...e, moving: spectator || e.side === side || e.kind === 'combat' ? e.moving : '?', targets: spectator || e.side === side ? e.targets : []
		}))
	};
}
