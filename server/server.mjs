import { sendPreset, presetView } from './emotes.mjs';
import { armBattleContinue, tickBattleContinue, battleContinueView } from './battle-continue.mjs';
import { initTurn, tickTurn, turnView, setupBlocked, checkTurnGate } from './turn-clock.mjs';
import { initSetup, tickSetup, pauseSetup, resumeSetup, setupView, setupAction } from './setup-clock.mjs';
import http from 'node:http';
import { installPresentation } from './presentation.mjs';
import { COMMANDERS, assignCommander, pairRoster, seatAvailable } from './commanders.mjs';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureTotals, createMatch, setup, move, view, shuffle, select, acknowledge, releaseReveal } from './game.mjs';
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export function createAuthority({ teacherKey = randomBytes(24).toString('hex'), classCode = randomBytes(2).toString('hex').toUpperCase(), snapshot = null, commanderPool = COMMANDERS, now = Date.now, timedSetup = true, timedTurns = true } = {}) {
	const presence = snapshot?.presence || {
		gameId: 'zN6Oyc9pDGlt60CITwGe', roomCode: randomBytes(2).toString('hex').toUpperCase(), sessionId: randomBytes(16).toString('hex')
	};
	const students = new Map(), tokens = new Map(), matches = new Map(), archives = new Map();
	const removedStudents = new Map(snapshot?.removedStudents || []), revokedTokens = new Set(snapshot?.revokedTokens || []);
	const emoteRecords = new Map(snapshot?.emotes || []);
	let order = [], phase = 'waiting', pairedCount = snapshot?.pairedCount ?? (snapshot?.matches?.length || 0) * 2;
	if (snapshot) {
		phase = snapshot.phase;
		order = [...snapshot.order];
		for (const { token, ...p } of snapshot.students) {
			p.lastSeen = now();
			students.set(p.id, p);
			tokens.set(token, p);
		}
		for (const m of snapshot.matches)
			matches.set(m.id, {
				...m, requests: new Map(m.requests || []), reveal: m.reveal ? m.events.find(e => e.kind === 'combat' && e.seq === m.reveal.seq) : null
			});
		for (const m of snapshot.archives || [])
			archives.set(m.id, {
				...m, requests: new Map(m.requests || []), reveal: m.reveal ? m.events.find(e => e.kind === 'combat' && e.seq === m.reveal.seq) : null
			});
	}
	const auth = t => {
		const p = tokens.get(t);
		if (!p)
			throw Error('Join the classroom again');
		p.lastSeen = now();
		return p;
	};
	const teacher = k => {
		if (k !== teacherKey)
			throw Error('Teacher authorization required');
	};
	const find = p => [...matches.values()].find(m => m.players.includes(p.id));
	const addMatch = ids => {
		const m = createMatch(ids);
		if (timedTurns) initTurn(m);
		if (timedSetup) initSetup(m);
		m.playerNames = ids.map(id => students.get(id).name);
		m.commanders = ids.map(id => structuredClone(students.get(id).commander));
		matches.set(m.id, m);
		return m;
	};
	const isPaired = p => {
		const index = order.indexOf(p.id), other = students.get(order[index ^ 1]);
		return index >= 0 && index < pairedCount && seatAvailable(p, now()) && other && seatAvailable(other, now());
	};
	const state = (p, advance = true) => {
		if (advance)
			tick();
		const m = [...archives.values()].find(m => {
			const side = m.players.indexOf(p.id);
			return !m.roundEnded && side >= 0 && m.events.some(e => e.kind === 'combat' && !e.ack[side]);
		}) || find(p);
		return {
			classCode, phase, presence, player: p.id, nickname: p.name, commander: p.commander || null, paired: isPaired(p), match: m ? {
				...view(m, m.players.indexOf(p.id)), ...presetView(emoteRecords, m, m.players.indexOf(p.id), now()), battleContinue: battleContinueView(m, m.players.indexOf(p.id)), setupBlocked: setupBlocked(m), turnClock: turnView(m, now()), setup: setupView(m, m.players.indexOf(p.id), phase, now()), playerNames: m.playerNames || m.players.map(id => students.get(id)?.name || "Player"), commanders: m.commanders || []
			} : null
		};
	};
	const roster = () => ({
		classCode, phase, presence, roster: order.map((id, i) => ({
			id, name: students.get(id).name, commander: students.get(id).commander || null, side: students.get(id).commander?.side, connected: seatAvailable(students.get(id), now()), pair: i < pairedCount ? Math.floor(i / 2) + 1 : 0, waiting: (phase === 'active' || phase === 'paused') ? ![...matches.values()].some(m => m.players.includes(id)) : !isPaired(students.get(id))
		})), matches: [...matches.values()].map(m => ({
			id: m.id, players: m.players, playerNames: m.playerNames, phase: m.phase, winner: m.winner, captures: captureTotals(m)
		}))
	});
	const tick = () => {
		for (const m of matches.values()) {
			tickBattleContinue(m, phase, now());
			tickSetup(m, phase, now());
			tickTurn(m, phase, now());
		}
	};
	return installPresentation({
		tick, clockView: m => ({
			setupBlocked: setupBlocked(m), turnClock: turnView(m, now()), ...presetView(emoteRecords, m, -1, now())
		}),
		teacherKey, classCode, students, matches, revokedTokens, __perspectiveChoices: new Map(snapshot?.perspectives || []),
		call(route, b = {}, token = '') {
			if (revokedTokens.has(token)) {
				if (route === 'state' || route === 'join') return {classCode, phase:'removed', removed:true, match:null, paired:false};
				throw Error('You were removed from this classroom by your teacher.');
			}
			if (route === 'emote') {
				const p = auth(token), m = find(p);
				if (!m || b.matchId !== m.id || phase !== 'active' || (m.phase !== 'play' && !m.reveal && !m.events.some(e => e.kind === 'combat' && e.ack?.some(ack => !ack))) || setupBlocked(m) || m.turnClock?.notice)
					throw Error('Messages are available during active play');
				sendPreset(emoteRecords, m, m.players.indexOf(p.id), b.emoteId, now());
				return state(p, false);
			}
			tick();
			if (route === 'join') {
				if (b.classCode !== classCode)
					throw Error('Incorrect class code');
				if (tokens.has(token))
					return {
						token, ...state(auth(token))
					};
				if (token) throw Error('Saved student seat is not valid for this classroom. Ask your teacher before joining again.');
				if (students.size >= 40)
					throw Error('Classroom is full');
				const commander = assignCommander(students, commanderPool, now()), name = commander.name;
				const id = randomBytes(12).toString('hex'), t = randomBytes(24).toString('hex'), p = {
					id, name, commander, lastSeen: now()
				};
				students.set(id, p);
				tokens.set(t, p);
				order.push(id);
				return {
					token: t, ...state(p)
				};
			}
			if (route === 'state')
				return state(auth(token));
			if (route === 'teacher/state') {
				teacher(token);
				return roster();
			}
			if (route === 'teacher/spectate') {
				teacher(token);
				const m = matches.get(b.matchId);
				if (!m && archives.get(b.matchId)?.roundEnded)
					return {
						classCode, phase, presence, match: null, roundEnded: true
					};
				if (!m)
					throw Error('Match not found');
				return {
					classCode, phase, presence, perspectiveName: students.get(m.players[m.reveal?.side ?? m.turn]).name, match: view(m, m.reveal?.side ?? m.turn, {
						spectator: true
					})
				};
			}
			if (route.startsWith('teacher/')) {
				teacher(token);
				const action = route.slice(8);
				if (action === 'randomize') {
					if (phase !== 'waiting' && phase !== 'ended')
						throw Error('End the round before changing pairs');
					const pairing = pairRoster(order, students, shuffle, now());
					order = pairing.order;
					pairedCount = pairing.pairedCount;
				}
				else if (action === 'swap') {
					if (phase !== 'waiting' && phase !== 'ended')
						throw Error('End the round before changing pairs');
					const a = order.indexOf(b.a), c = order.indexOf(b.b);
					if (a < 0 || c < 0 || a === c)
						throw Error('Choose two different students');
					if (students.get(b.a).commander.side !== students.get(b.b).commander.side)
						throw Error('Swap two commanders from the same faction to change opponents. Union and Confederate assignments stay fixed.');
					if (!seatAvailable(students.get(b.a), now()) || !seatAvailable(students.get(b.b), now()))
						throw Error('Both students must reconnect before swapping seats.');
					const next = [...order];
					[next[a], next[c]] = [next[c], next[a]];
					order = next;
				}
				else if (action === 'start') {
					if (phase !== 'waiting' && phase !== 'ended')
						throw Error('Round already started');
					if (order.length < 2)
						throw Error('At least two students are needed');
					const pairing = pairRoster(order, students, list => [...list], now());
					if (pairing.pairedCount < 2)
						throw Error('At least one connected Union and one connected Confederate student are needed.');
					order = pairing.order;
					pairedCount = pairing.pairedCount;
					for (const m of matches.values()) {
						m.archived = true;
						archives.set(m.id, m);
					}
					matches.clear();
					emoteRecords.clear();
					for (let i = 0; i + 1 < pairedCount; i += 2) addMatch([order[i], order[i + 1]]);
					phase = 'active';
				}
				else if (action === 'remove') {
					if (removedStudents.has(b.a)) return roster();
					const p = students.get(b.a);
					if (!p) throw Error('Student is no longer in this classroom.');
					const m = find(p), index = order.indexOf(p.id);
					const partner = index >= 0 && index < pairedCount ? order[index ^ 1] : null;
					if (m) {
						pauseSetup(m, now()); m.setupCancelled = true; m.roundEnded = true; m.archived = true; m.removedPlayer = p.id;
						archives.set(m.id, m); matches.delete(m.id); emoteRecords.delete(m.id);
					}
					const paired = order.slice(0, pairedCount).filter(id => id !== p.id && id !== partner);
					const waiting = order.slice(pairedCount).filter(id => id !== p.id);
					if (partner) waiting.push(partner);
					order = [...paired, ...waiting]; pairedCount = paired.length;
					removedStudents.set(p.id, {...p, removedAt:now()});
					students.delete(p.id);
					for (const [t, seat] of tokens) if (seat.id === p.id) { revokedTokens.add(t); tokens.delete(t); }
				}
				else if (action === 'pair') {
					if (phase !== 'active' && phase !== 'paused') throw Error('Start the round before pairing late arrivals.');
					const first = students.get(b.a), second = students.get(b.b);
					if (!first || !second || first.id === second.id) throw Error('Choose two different waiting students.');
					const existing = find(first);
					if (existing?.players.includes(second.id)) return roster(); // Idempotent duplicate click/retry.
					if (existing || find(second)) throw Error('Choose unpaired students; existing games cannot be reassigned.');
					if (!seatAvailable(first, now()) || !seatAvailable(second, now())) throw Error('Both waiting students must be connected.');
					if (first.commander.side === second.commander.side) throw Error('Choose one Union and one Confederate waiting student.');
					const ids = first.commander.side === 0 ? [first.id, second.id] : [second.id, first.id];
					const waiting = order.slice(pairedCount).filter(id => !ids.includes(id));
					order = [...order.slice(0, pairedCount), ...ids, ...waiting];
					pairedCount += 2;
					addMatch(ids);
				}
				else if (action === 'pause') {
					if (phase !== 'active')
						throw Error('Round is not active');
					for (const m of matches.values())
						pauseSetup(m, now());
					phase = 'paused';
					tick();
				}
				else if (action === 'resume') {
					if (phase !== 'paused')
						throw Error('Round is not paused');
					for (const m of matches.values())
						resumeSetup(m, now());
					tick();
					phase = 'active';
					tick();
				}
				else if (action === 'end') {
					for (const m of matches.values()) {
						pauseSetup(m, now());
						m.setupCancelled = true;
						m.roundEnded = true;
						m.archived = true;
						archives.set(m.id, m);
					}
					matches.clear();
					pairedCount = 0;
					emoteRecords.clear();
					phase = 'ended';
				}
				else if (action === 'release-reveal') {
					const m = matches.get(b.matchId);
					if (!m)
						throw Error('Match not found');
					releaseReveal(m, b.side, b.seq);
				}
				else
					throw Error('Unknown teacher action');
				return roster();
			}
			const p = auth(token), m = find(p);
			if (route === 'battle/ready') {
				if (!m || b.matchId !== m.id || phase === 'ended')
					throw Error('Current match required');
				armBattleContinue(m, m.players.indexOf(p.id), b.seq, now());
				return state(p);
			}
			if (route === 'ack') {
				if (b.automatic && phase !== 'active')
					throw Error('Automatic continue waits for an active session');
				const target = b.matchId ? (matches.get(b.matchId) || archives.get(b.matchId)) : m;
				if (!target || !target.players.includes(p.id))
					throw Error('Match not found');
				acknowledge(target, target.players.indexOf(p.id), b.seq);
				return state(p);
			}
			if (phase !== 'active')
				throw Error('The teacher has not enabled play');
			if (!m)
				throw Error('Waiting for a pair next round');
			const side = m.players.indexOf(p.id);
			if (route === 'select' || route === 'move')
				checkTurnGate(m);
			if (m.setupClocks && (route === 'setup' || route.startsWith('setup/')))
				setupAction(m, side, route, b, now());
			else if (route === 'setup')
				setup(m, side, b.ranks);
			else if (route === 'select')
				select(m, side, b.from, b.seq);
			else if (route === 'move')
				move(m, side, b.from, b.to, b.seq, b.requestId);
			else
				throw Error('Unknown action');
			return state(p);
		}
	});
}
export function serve(authority, port = 8080, webglRoot = process.env.HISTORY_WEBGL_ROOT || 'Builds/WebGL') {
	const server = http.createServer(async (req, res) => {
		res.setHeader('Cache-Control', 'no-store');
		res.setHeader('X-Content-Type-Options', 'nosniff');
		try {
			const url = new URL(req.url, 'http://localhost');
			if (url.pathname.startsWith('/api/')) {
				if (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host)
					throw Error('Cross-origin request denied');
				const chunks = [];
				let size = 0;
				for await (const c of req) {
					size += c.length;
					if (size > 20000)
						throw Error('Request too large');
					chunks.push(c);
				}
				const b = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
				const token = (req.headers.authorization || '').replace(/^Bearer /, '');
				const data = authority.call(url.pathname.slice(5), b, token);
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify(data));
				return;
			}
			const path = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
			const base = path.startsWith('/unity/') ? resolve(ROOT, webglRoot) : resolve(ROOT, 'web');
			const file = resolve(base, '.' + (path.startsWith('/unity/') ? path.slice(6) : path));
			if (!file.startsWith(base + '/') && !file.startsWith(base + '\\'))
				throw Error('Invalid path');
			const types = {
				'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.wasm': 'application/wasm'
			};
			res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
			res.end(await readFile(file));
		}
		catch (e) {
			res.statusCode = 400;
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify({
				error: e.message
			}));
		}
	});
	const setupTimer = setInterval(() => authority.tick(), 250);
	setupTimer.unref();
	server.on('close', () => clearInterval(setupTimer));
	return server.listen(port, '127.0.0.1');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const a = createAuthority();
	serve(a, Number(process.env.PORT || 8080));
	console.log('Local prototype: http://127.0.0.1:' + (process.env.PORT || 8080));
	console.log('Class code: ' + a.classCode);
	console.log('Teacher key (keep private): ' + a.teacherKey);
	console.log('In-memory sessions. Restart clears all rounds. Loopback only.');
}
