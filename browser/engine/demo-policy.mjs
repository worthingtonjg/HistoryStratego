import { attackApproaches, attackPressure } from './pressure-policy.mjs';
import { reachableFrontier, quietMoveMobility } from './mobility-policy.mjs';
import { observeRanks, knownOutcome } from './public-knowledge.mjs';
// Pure next-session policy. Inputs must be this participant's own redacted view.
const LAKES = new Set([42, 43, 46, 47, 52, 53, 56, 57]);
const neighbors = i => [i - 10, i + 10, ...(i % 10 ? [i - 1] : []), ...(i % 10 < 9 ? [i + 1] : [])].filter(j => j >= 0 && j < 100 && !LAKES.has(j));
const distance = (a, b) => Math.abs(a % 10 - b % 10) + Math.abs(Math.floor(a / 10) - Math.floor(b / 10));
const home = (i, side) => side === 0 ? i >= 50 : i < 50;
const ownMiner = (p, side) => p?.side === side && p.rank === '3';
function fresh(m) {
	return {
		version: 2, knowledge: null, spyTarget: null, matchId: m.id, side: m.side, lastSeq: m.seq, bombs: {}, miners: {}, nextMiner: 1, assignment: null, visits: {}
	};
}
function synchronize(m, previous) {
	const valid = previous?.version === 2 && previous.matchId === m.id && previous.side === m.side;
	const mem = valid ? structuredClone(previous) : fresh(m), events = [...(m.events || [])].sort((a, b) => a.seq - b.seq);
	// Track identity using our own moves and public combat; never read enemy board ranks.
	if (valid)
		for (const e of events.filter(e => e.seq > mem.lastSeq)) {
			if (e.side === m.side) {
				const id = Object.keys(mem.miners).find(id => mem.miners[id] === e.from);
				if (id) {
					if (e.kind === 'move' || (e.kind === 'combat' && e.outcome > 0))
						mem.miners[id] = e.to;
					else if (e.kind === 'combat')
						delete mem.miners[id];
				}
			}
			else if (e.kind === 'combat' && e.outcome >= 0) {
				for (const id of Object.keys(mem.miners))
					if (mem.miners[id] === e.to)
						delete mem.miners[id];
			}
			if (e.side === m.side && ['move', 'combat'].includes(e.kind))
				mem.visits[e.to] = (mem.visits[e.to] || 0) + 1;
		}
	// Full public journal supports reconnect/late initialization without guessing setup.
	for (const e of events) {
		if (e.kind !== 'combat' || e.side !== m.side || e.defender !== 'B')
			continue;
		const key = String(e.to), old = mem.bombs[key];
		if (!old)
			mem.bombs[key] = {
				square: e.to, discoveredSeq: e.seq, lastEventSeq: e.seq, removed: e.outcome >= 0
			};
		else if (e.seq > old.lastEventSeq) {
			old.lastEventSeq = e.seq;
			if (e.outcome >= 0)
				old.removed = true;
		}
	}
	for (const bomb of Object.values(mem.bombs))
		if (!bomb.removed && (!m.board[bomb.square] || m.board[bomb.square].side === m.side))
			bomb.removed = true;
	for (const id of Object.keys(mem.miners))
		if (!ownMiner(m.board[mem.miners[id]], m.side))
			delete mem.miners[id];
	for (let i = 0; i < 100; i++)
		if (ownMiner(m.board[i], m.side) && !Object.values(mem.miners).includes(i))
			mem.miners['miner-' + mem.nextMiner++] = i;
	mem.enemySpyEliminated = mem.enemySpyEliminated === true || events.some(e => e.kind === 'combat' && (e.side === m.side ? e.defender === '1' && e.outcome >= 0 : e.attacker === '1' && e.outcome <= 0));
	mem.knowledge = observeRanks(m, mem.knowledge);
	mem.lastSeq = m.seq;
	return mem;
}
// Unknown enemy pieces and friendly pieces are obstacles, not assumed capturable paths.
function route(board, start, goal, safe) {
	const queue = [[start]], seen = new Set([start]);
	for (let q = 0; q < queue.length; q++) {
		const path = queue[q], at = path.at(-1);
		for (const next of neighbors(at)) {
			if (seen.has(next) || !safe(next) || next !== goal && board[next])
				continue;
			const p = [...path, next];
			if (next === goal)
				return p;
			seen.add(next);
			queue.push(p);
		}
	}
	return null;
}
export function planDemoMoves(state, previous, { restrictMinerAttacks = true, restrictMarshalAttacks = true } = {}) {
	const m = state.match || state;
	if (!m?.id || !Array.isArray(m.board) || m.board.length !== 100 || ![0, 1].includes(m.side))
		throw Error('Own redacted match view required');
	const memory = synchronize(m, previous), known = Object.values(memory.bombs).filter(b => !b.removed).sort((a, b) => a.discoveredSeq - b.discoveredSeq || a.square - b.square);
	const knownSquares = new Set(known.map(b => b.square));
	const danger = i => m.board[i]?.side === 1 - m.side && !knownSquares.has(i) || neighbors(i).some(j => m.board[j]?.side === 1 - m.side && !knownSquares.has(j));
	const safe = i => !danger(i);
	// A known bomb is a concrete objective. Unknown adjacent defenders are a risk,
	// not proof that every route is impossible. Never infer their hidden ranks.
	const observed = new Map(Object.values(memory.knowledge.pieces).map(p => [p.square, p.rank]));
	const missionSafe = i => !(m.board[i]?.side === 1 - m.side && !knownSquares.has(i) && !['1', '2'].includes(observed.get(i))) && !neighbors(i).some(j => {
		if (m.board[j]?.side !== 1 - m.side || knownSquares.has(j)) return false;
		const rank = observed.get(j);
		return rank && !['B', 'F', '1', '2'].includes(rank);
	});
	const bombRoute = (from, to) => route(m.board, from, to, safe) || route(m.board, from, to, missionSafe);
	let assignment = memory.assignment, path = null;
	if (assignment && memory.miners[assignment.minerId] !== undefined && known.some(b => b.square === assignment.bombSquare))
		path = bombRoute(memory.miners[assignment.minerId], assignment.bombSquare);
	if (!path) {
		assignment = null;
		const options = [];
		for (const bomb of known)
			for (const [minerId, from] of Object.entries(memory.miners)) {
				const p = bombRoute(from, bomb.square);
				if (p)
					options.push({
						minerId, bombSquare: bomb.square, path: p, discoveredSeq: bomb.discoveredSeq
					});
			}
		options.sort((a, b) => a.path.length - b.path.length || a.discoveredSeq - b.discoveredSeq || a.bombSquare - b.bombSquare || a.minerId.localeCompare(b.minerId));
		if (options.length) {
			const best = options[0];
			assignment = {
				minerId: best.minerId, bombSquare: best.bombSquare
			};
			path = best.path;
		}
	}
	memory.assignment = assignment;
	const knownRanks = new Map(Object.values(memory.knowledge.pieces).map(p => [p.square, p.rank]));
	// Bomb history remains useful even when a truncated movement journal drops mobile identity.
	for (const b of known)
		knownRanks.set(b.square, 'B');
	const spyAt = m.board.findIndex(p => p?.side === m.side && p.rank === '1');
	const spySafe = (to, from, captured = -1) => {
		if (m.board[to]?.side === 1 - m.side && to !== captured)
			return false;
		for (let e = 0; e < 100; e++) {
			if (e === captured || m.board[e]?.side !== 1 - m.side)
				continue;
			const rank = knownRanks.get(e);
			if (rank === 'B' || rank === 'F')
				continue;
			if (distance(e, to) === 1)
				return false;
			if (rank === '2' && (e % 10 === to % 10 || Math.floor(e / 10) === Math.floor(to / 10))) {
				const step = e % 10 === to % 10 ? (to > e ? 10 : -10) : (to > e ? 1 : -1);
				let clear = true;
				for (let j = e + step; j !== to; j += step)
					if (LAKES.has(j) || (j !== from && m.board[j])) {
						clear = false;
						break;
					}
				if (clear)
					return false;
			}
		}
		return true;
	};
	const marshals = Object.entries(memory.knowledge.pieces).filter(([, p]) => p.rank === '10');
	let spyPath = null;
	memory.spyTarget = spyAt < 0 ? null : memory.spyTarget;
	const options = [];
	if (spyAt >= 0)
		for (const [id, target] of marshals) {
			if (distance(spyAt, target.square) === 1 && spySafe(target.square, spyAt, target.square))
				options.push({
					id, path: [spyAt, target.square], attack: true
				});
			for (let to = 0; to < 100; to++) {
				if (distance(to, target.square) !== 2 || LAKES.has(to) || (to !== spyAt && m.board[to]) || !spySafe(to, spyAt))
					continue;
				const path = to === spyAt ? [spyAt] : route(m.board, spyAt, to, i => spySafe(i, spyAt));
				if (path)
					options.push({
						id, path, attack: false
					});
			}
		}
	options.sort((a, b) => Number(b.attack) - Number(a.attack) || Number(b.id === memory.spyTarget) - Number(a.id === memory.spyTarget) || a.path.length - b.path.length || a.id.localeCompare(b.id) || a.path.at(-1) - b.path.at(-1));
	if (options.length) {
		memory.spyTarget = options[0].id;
		spyPath = options[0].path;
	}
	else
		memory.spyTarget = null;
	const returnPaths = new Map();
	for (let from = 0; from < 100; from++) {
		const p = m.board[from];
		if (p?.side !== m.side || !['1', '3'].includes(p.rank) || home(from, m.side))
			continue;
		const mission = p.rank === '1' ? memory.spyTarget !== null : assignment && memory.miners[assignment.minerId] === from;
		if (mission)
			continue;
		const choices = [];
		for (let goal = 0; goal < 100; goal++)
			if (home(goal, m.side) && !LAKES.has(goal) && !m.board[goal]) {
				const r = route(m.board, from, goal, i => p.rank === '1' ? spySafe(i, from) : safe(i));
				if (r)
					choices.push(r);
			}
		choices.sort((a, b) => a.length - b.length || a.at(-1) - b.at(-1));
		if (choices.length)
			returnPaths.set(from, choices[0]);
	}
	const marshalRoutes = new Map();
	for (let from = 0; from < 100; from++) if (m.board[from]?.side === m.side && m.board[from].rank === '10') {
		const routes = [...knownRanks].filter(([at, rank]) => m.board[at]?.side === 1 - m.side && Number(rank) >= 2 && (Number(rank) <= 9 || rank === '10' && memory.enemySpyEliminated))
			.map(([at]) => route(m.board, from, at, () => true)).filter(Boolean).sort((a,b) => a.length-b.length || a.at(-1)-b.at(-1));
		if (routes.length) marshalRoutes.set(from, routes[0]);
	}
	const candidates = [], fallback = [], emergency = [];
	const reachable = reachableFrontier(m.board, m.side);
	const approaches = attackApproaches(m.board, m.side, knownSquares);
	let boundaryBlocked = 0;
	for (let from = 0; from < 100; from++) {
		const p = m.board[from];
		if (!p || p.side !== m.side || ['B', 'F'].includes(p.rank))
			continue;
		for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]])
			for (let n = 1; n <= (p.rank === '2' ? 9 : 1); n++) {
				const x = from % 10 + dx * n, y = Math.floor(from / 10) + dy * n;
				if (x < 0 || x > 9 || y < 0 || y > 9)
					break;
				const to = y * 10 + x, q = m.board[to];
				if (LAKES.has(to) || q?.side === m.side)
					break;
				const minerAttack = p.rank === '3' && q && ['1', '2', 'B'].includes(knownRanks.get(to));
				if (restrictMinerAttacks && p.rank === '3' && q && !minerAttack) break;
				if (restrictMarshalAttacks && p.rank === '10' && q && (['1', 'B'].includes(knownRanks.get(to)) || knownRanks.get(to) === '10' && !memory.enemySpyEliminated)) break;
				const assigned = assignment && memory.miners[assignment.minerId] === from;
				const special = ['1', '3'].includes(p.rank), mission = p.rank === '1' ? memory.spyTarget !== null : assigned;
				const returnPath = returnPaths.get(from);
				const homeAllowed = !special || mission || minerAttack || home(to, m.side) || (!home(from, m.side) && returnPath?.[1] === to);
				if (!homeAllowed) {
					const loss = knownOutcome(p.rank, knownRanks.get(to));
					const safeTarget = p.rank === '1' ? spySafe(to, from, loss === 1 && knownRanks.get(to) === '10' ? to : -1) : safe(to);
					emergency.push({
						from, to, score: (loss < 0 ? -100 - Number(p.rank) : 0) - (safeTarget ? 0 : 30), reason: 'forced-home-crossing'
					});
					boundaryBlocked++;
					if (q)
						break;
					continue;
				}
				const outcome = knownOutcome(p.rank, knownRanks.get(to));
				const unsafeMiner = p.rank === '3' && !(minerAttack || assigned && path?.[1] === to ? missionSafe(to) : safe(to)), unsafeSpy = p.rank === '1' && !spySafe(to, from, outcome === 1 && knownRanks.get(to) === '10' ? to : -1);
				fallback.push({
					from, to, score: (outcome < 0 ? -100 - Number(p.rank) : 0) - (unsafeMiner || unsafeSpy ? 30 : 0), reason: outcome < 0 ? 'forced-known-loss' : 'forced-safety-fallback'
				});
				if (outcome < 0 || unsafeSpy || (p.rank === '1' && spyPath?.length === 1 && spySafe(from, from))) {
					if (q)
						break;
					continue;
				}
				if (unsafeMiner) {
					if (q)
						break;
					continue;
				}
				const bomb = memory.bombs[to];
				if (bomb && !bomb.removed && !(p.rank === '3' && assigned && assignment.bombSquare === to)) {
					if (q)
						break;
					continue;
				}
				const pressure = attackPressure(m.board, m.side, from, to, approaches, m.events);
				let score = pressure.score - Math.min(memory.visits[to] || 0, 4) * .5 + (q ? (p.rank === '3' ? 29 : p.rank === '2' ? 26 : p.rank === '1' ? -5 : 22) + (outcome > 0 ? 18 : 0) + (knownRanks.get(to) === 'F' ? 100 : 0) : 0);
				let reason = 'ordinary';
				if (p.rank === '10' && marshalRoutes.get(from)?.[1] === to) { score += q ? 80 : 40; reason = 'marshal-known-pawn-route'; }
				if (returnPath?.[1] === to) {
					score += 1500;
					reason = 'safe-return-home';
				}
				if (p.rank === '3' && danger(from)) {
					score += 2000;
					reason = 'miner-safe-retreat';
				}
				if (assigned && path?.[1] === to) {
					score += 1000;
					reason = 'assigned-bomb-route';
				}
				if (p.rank === '1' && !spySafe(from, from)) {
					score += 2000;
					reason = 'spy-safe-retreat';
				}
				if (p.rank === '1' && spyPath?.[1] === to) {
					score += knownRanks.get(to) === '10' ? 3000 : 900;
					reason = knownRanks.get(to) === '10' ? 'spy-known-marshal-attack' : 'spy-standoff-route';
				}
				// Preserve attacks, mission approaches/returns and safety retreats. This is a score, never a legal filter.
				const mobility = !q && reason === 'ordinary' && !(danger(from) && !danger(to)) ? quietMoveMobility(m.board, m.side, from, to, reachable) : {
					kind: 'protected-action', adjustment: 0
				};
				score += mobility.adjustment;
				// Unassigned miners have no target/route bonus and never attack another known bomb.
				candidates.push({
					from, to, score, reason, mobility: mobility.kind, pressure
				});
				if (q)
					break;
			}
	}
	candidates.sort((a, b) => b.score - a.score || a.from - b.from || a.to - b.to);
	fallback.sort((a, b) => b.score - a.score || a.from - b.from || a.to - b.to);
	emergency.sort((a, b) => b.score - a.score || a.from - b.from || a.to - b.to);
	return {
		memory, candidates, fallback, emergency, boundaryBlocked, status: assignment ? 'pursuing-known-bomb' : known.length ? 'known-bombs-no-reachable-miner' : 'ordinary'
	};
}
