// Single-seat NPC. Never reads another seat, sends teacher commands, or acknowledges the human.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { planDemoMoves } from './demo-policy.mjs';
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
export function createOpponent({ command, delay, now = Date.now, emit = () => {
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
async function main() {
	const seat = process.argv[2];
	if (!/^[a-z0-9-]+$/.test(seat || ''))
		throw Error('Usage: node tools/human-opponent.mjs <bot-seat>');
	const controlPath = 'Logs/' + seat + '-opponent-control.json', memoryPath = 'Logs/' + seat + '-opponent-memory.json', sleep = ms => new Promise(r => setTimeout(r, ms));
	const control = async () => {
		try {
			return JSON.parse(await readFile(controlPath, 'utf8'));
		}
		catch {
			return {
				pause: true
			};
		}
	};
	async function enabled() {
		const c = await control();
		if (c.stop || c.pause !== false)
			throw Error('Opponent driver stopped or paused');
	}
	async function delay(ms) {
		const end = Date.now() + ms;
		while (Date.now() < end) {
			await enabled();
			await sleep(Math.min(250, Math.max(1, end - Date.now())));
		}
	}
	async function command(action, body = {}) {
		if (!['status', 'select', 'move', 'ack'].includes(action))
			throw Error('Single-seat action is not allowed');
		await enabled();
		const path = 'Logs/' + seat + '.log', before = (await readFile(path, 'utf8')).length;
		await writeFile('Logs/' + seat + '-command.json', JSON.stringify({
			action, ...body, requestId: 'opponent-' + Date.now() + '-' + Math.random()
		}));
		const until = Date.now() + 20000;
		while (Date.now() < until) {
			await delay(200);
			const added = (await readFile(path, 'utf8')).slice(before);
			for (const line of added.split(/\r?\n/)) {
				if (!line.startsWith('{'))
					continue;
				let result;
				try {
					result = JSON.parse(line);
				}
				catch {
					continue;
				}
				if (result.error)
					throw Error(result.error);
				return result;
			}
		}
		throw Error('Own participant controller did not reply; waiting for recovery');
	}
	let memory = null;
	try {
		memory = JSON.parse(await readFile(memoryPath, 'utf8'));
	}
	catch {
	}
	const bot = createOpponent({
		command, delay, initialMemory: memory, persist: m => writeFile(memoryPath, JSON.stringify(m)), emit: x => console.log(JSON.stringify(x))
	});
	await writeFile('Logs/' + seat + '-opponent.pid', String(process.pid));
	console.log(JSON.stringify({
		ready: true, seat, controlPath, policy: 'bomb-aware', scope: 'one own-redacted seat only'
	}));
	let previousError = '';
	for (; ;) {
		const c = await control();
		if (c.stop)
			break;
		if (c.pause !== false) {
			bot.pause();
			await sleep(500);
			continue;
		}
		try {
			await bot.tick();
			previousError = '';
		}
		catch (e) {
			bot.pause();
			if (e.message !== previousError) {
				console.log(JSON.stringify({
					status: 'waiting-recovery', message: e.message
				}));
				previousError = e.message;
			}
		}
		await sleep(750);
	}
	console.log(JSON.stringify({
		stopped: true, seat
	}));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
	main().catch(e => {
		console.error(e.message);
		process.exitCode = 1;
	});
