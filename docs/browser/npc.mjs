// Single-seat NPC. Never reads another seat, sends teacher commands, or acknowledges the human.
import { planDemoMoves } from './engine/demo-policy.mjs';
export function opponentCanArm(state, matchId) {
	const m = state?.match;
	return state?.phase === 'active' && m?.id === matchId && m.phase === 'play' && m.ready?.every(Boolean) && !m.setupBlocked;
}
export function opponentAction(state) {
	const m = state?.match;
	if (state?.phase !== 'active')
		return 'wait-session';
	if (!m)
		return 'wait-assignment';
	if (![0, 1].includes(m.side))
		return 'wait-invalid-seat';
	if (m.battle && !m.battle.ack?.[m.side])
		return 'review-own-combat';
	if (m.blocked || m.battle)
		return 'wait-human-continue';
	if (m.phase === 'over')
		return 'finished';
	if (m.phase !== 'play' || !m.ready?.every(Boolean))
		return 'wait-setup';
	if (m.setupBlocked)
		return 'wait-setup-notice';
	if (m.turnClock?.noticeRemainingMs > 0)
		return 'wait-timeout-notice';
	if (m.turnClock?.bannerRemainingMs > 0)
		return 'wait-turn-banner';
	return m.turn === m.side ? 'move' : 'wait-human-turn';
}
function policyOpponent({ command, delay, now = Date.now, emit = () => {
}, initialMemory = null, persist = async () => {
} }) {
	let round = '', firstMove = true;
	let memory = initialMemory, review = '', reviewStarted = 0, cooldown = 0, stalled = '', stalledReason = '', lastStatus = '';
	const report = (status, extra = {}) => {
		const text = JSON.stringify({
			status, ...extra
		});
		if (text !== lastStatus) {
			emit(JSON.parse(text));
			lastStatus = text;
		}
	};
	return {
		pause() {
			review = '';
		}, async tick() {
			const state = await command('status'), m = state?.match, action = opponentAction(state), key = m ? m.id + ':' + m.seq : '';
			if (m && round !== m.id) {
				round = m.id;
				firstMove = true;
				cooldown = 0;
				stalled = '';
				review = '';
			}
			if (action === 'review-own-combat') {
				const battleKey = m.id + ':' + m.battle.seq;
				if (review !== battleKey) {
					review = battleKey;
					reviewStarted = now();
					report('reviewing-own-combat', {
						seq: m.battle.seq, combat: m.battle.text
					});
				}
				if (now() - reviewStarted < 8000)
					return;
				const latest = await command('status');
				if (opponentAction(latest) === 'review-own-combat' && latest.match.id === m.id && latest.match.battle.seq === m.battle.seq) {
					await command('ack');
					report('own-combat-continued', {
						seq: m.battle.seq
					});
				}
				else
					review = '';
				return;
			}
			review = '';
			if (action !== 'move') {
				report(action, {
					seq: m?.seq, winner: action === 'finished' ? m.winner : undefined
				});
				return;
			}
			if (now() < cooldown)
				return;
			if (stalled === key) {
				report('stalled', {
					seq: m.seq, reason: stalledReason
				});
				return;
			}
			const plan = planDemoMoves(state, memory);
			memory = plan.memory;
			await persist(memory);
			let choice, usedFallback = false;
			const allowedByPiece = new Map();
			let selectedFrom = -1;
			for (const pool of [plan.candidates, plan.fallback || [], plan.emergency || []]) {
				const attempted = new Set();
				for (const option of pool) {
					if (attempted.has(option.from))
						continue;
					attempted.add(option.from);
					if (!allowedByPiece.has(option.from)) {
						const selected = await command('select', {
							from: option.from
						});
						if (opponentAction(selected) !== 'move' || selected.match.id !== m.id || selected.match.seq !== m.seq)
							return;
						selectedFrom = option.from;
						allowedByPiece.set(option.from, selected.match.selection?.targets || []);
					}
					const allowed = allowedByPiece.get(option.from);
					choice = pool.find(c => c.from === option.from && allowed.some(t => t.to === c.to));
					if (choice)
						break;
				}
				if (choice)
					break;
				usedFallback = true;
			}
			if (choice && selectedFrom !== choice.from) {
				const selected = await command('select', {
					from: choice.from
				});
				if (opponentAction(selected) !== 'move' || selected.match.id !== m.id || selected.match.seq !== m.seq || !selected.match.selection?.targets.some(t => t.to === choice.to))
					return;
			}
			if (choice && usedFallback)
				report('policy-fallback', {
					seq: m.seq, reason: choice.reason
				});
			if (!choice) {
				stalled = key;
				stalledReason = 'No authoritative legal target is available.';
				report('stalled', {
					seq: m.seq, reason: stalledReason, policy: plan.status
				});
				return;
			}
			report('selected', {
				side: m.side, seq: m.seq, from: choice.from
			});
			await delay(firstMove ? 1200 : 2400);
			const latest = await command('status');
			if (opponentAction(latest) !== 'move' || latest.match.id !== m.id || latest.match.seq !== m.seq || latest.match.selection?.from !== choice.from || !latest.match.selection.targets.some(t => t.to === choice.to))
				return;
			const moved = await command('move', {
				from: choice.from, to: choice.to
			});
			firstMove = false;
			cooldown = now() + 4000;
			report('moved', {
				side: m.side, seq: moved.match?.seq, from: choice.from, to: choice.to
			});
		}
	};
}
export function createOpponent(authority, teacherKey, classCode, savedToken = '', {isActive=()=>true,now=Date.now,initialMemory=null,persist=async()=>{}} = {}) {
	const joined = savedToken ? authority.call('state', {}, savedToken) : authority.call('join', {
		classCode
	}), token = savedToken || joined.token;
	authority.call('teacher/npc',{a:joined.player},teacherKey);
	let stopped = false, busy = false;
	const state = () => authority.call('state', {}, token);
	async function command(action, body = {}) {
		if(stopped || !isActive()) throw Error('Opponent is paused');
		const s = state(), m = s.match;
		if (action === 'status')
			return s;
		if (!m || s.phase !== 'active')
			throw Error('Wait');
		if (action === 'ack')
			return authority.call('ack', {
				matchId: m.id, seq: m.battle.seq
			}, token);
		return authority.call(action, {
			...body, seq: m.seq, requestId: crypto.randomUUID()
		}, token);
	}
	const bot = policyOpponent({
		command, now, initialMemory, persist, delay: ms => new Promise(r => setTimeout(r, ms))
	});
	const timer = setInterval(async () => {
		if (stopped || busy || !isActive())
			return;
		busy = true;
		try {
			let s = state(), m = s.match;
			if (s.phase === 'active' && m?.phase === 'setup' && !m.ready[m.side]) {
				authority.call('teacher/setup-npc',{a:s.player,matchId:m.id},teacherKey);
			}
			await bot.tick();
		}
		catch {
		}
		finally {
			busy = false;
		}
	}, 750);
	return {
		name: joined.nickname, token, stop() {
			stopped = true;
			clearInterval(timer);
		}
	};
}
