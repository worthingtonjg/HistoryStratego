import { generateFormation } from './formation.mjs';
import { createPresenceController } from './playroom.mjs';
const $ = id => document.getElementById(id), counts = {
	F: 1, B: 6, 1: 1, 2: 8, 3: 5, 4: 4, 5: 4, 6: 4, 7: 3, 8: 2, 9: 1, 10: 1
};
const names = {
	F: 'Flag', B: 'Bomb', 1: 'Spy', 2: 'Scout', 3: 'Miner', 4: 'Sgt', 5: 'Lt', 6: 'Capt', 7: 'Major', 8: 'Col', 9: 'Gen', 10: 'Marshal'
};
let token = sessionStorage.getItem('studentToken') || '', teacherToken = '', state = null, formation = generateFormation(), selected = -1, swap = null, busy = false, lastMatch = '', pending = null;
async function api(route, body = {}, key = token) {
	const r = await fetch('/api/' + route, {
		method: 'POST', headers: {
			'Content-Type': 'application/json', Authorization: 'Bearer ' + key
		}, body: JSON.stringify(body)
	});
	const v = await r.json();
	if (!r.ok)
		throw Error(v.error);
	return v;
}
const presence = createPresenceController({
	status: s => {
		$('playroomStatus').textContent = s.text;
		$('playroomStatus').dataset.state = s.state;
		$('playroomStatus').dataset.room = s.roomCode;
	}
});
const err = e => $('error').textContent = e.message;
async function action(fn) {
	if (busy)
		return;
	busy = true;
	$('error').textContent = '';
	try {
		await fn();
	}
	catch (e) {
		err(e);
	}
	finally {
		busy = false;
	}
}
$('join').onclick = () => action(async () => {
	state = await api('join', {
		classCode: $('code').value.trim().toUpperCase()
	});
	token = state.token;
	sessionStorage.setItem('studentToken', token);
	render();
});
$('teacher').onclick = () => action(async () => {
	teacherToken = $('key').value;
	renderTeacher(await api('teacher/state', {}, teacherToken));
	$('login').hidden = true;
	$('teacherPanel').hidden = false;
});
for (const name of ['randomize', 'start', 'pause', 'resume', 'end']) {
	const b = document.createElement('button');
	b.textContent = name[0].toUpperCase() + name.slice(1);
	b.onclick = () => action(async () => renderTeacher(await api('teacher/' + name, {}, teacherToken)));
	$('controls').append(b);
}
function renderTeacher(s) {
	presence.sync(s);
	$('teacherStatus').textContent = 'Class ' + s.classCode + ' • ' + s.phase + ' • ' + s.roster.length + ' students';
	$('roster').replaceChildren();
	for (const p of s.roster) {
		const b = document.createElement('button');
		b.textContent = p.name + ' — ' + (p.waiting ? 'waiting' : 'pair ' + p.pair);
		b.style.outline = p.id === swap ? '3px solid goldenrod' : '';
		b.onclick = () => action(async () => {
			if (!swap) {
				swap = p.id;
				renderTeacher(s);
			}
			else {
				const a = swap;
				swap = null;
				renderTeacher(await api('teacher/swap', {
					a, b: p.id
				}, teacherToken));
			}
		});
		$('roster').append(b);
	}
}
function shuffle() {
	formation = generateFormation();
	selected = -1;
	render();
}
$('shuffle').onclick = shuffle;
$('ready').onclick = () => action(async () => {
	state = await api('setup', {
		ranks: formation
	});
	render();
});
function render() {
	if (!state)
		return;
	presence.sync(state);
	$('login').hidden = true;
	$('studentPanel').hidden = false;
	const m = state.match;
	$('status').textContent = state.nickname + ' • ' + state.phase + (m ? ' • ' + (m.side === 0 ? 'Confederate forces' : 'Union forces') : ' • Waiting for assignment');
	$('setupControls').hidden = !m || m.phase !== 'setup' || m.ready[m.side];
	$('ready').disabled = state.phase !== 'active';
	if (!m) {
		$('board').replaceChildren();
		$('hint').textContent = 'Your teacher will pair students and start a round. Late arrivals wait for the next round.';
		return;
	}
	if (lastMatch !== m.id) {
		lastMatch = m.id;
		selected = -1;
		pending = null;
		formation = generateFormation();
	}
	const editing = m.phase === 'setup' && !m.ready[m.side];
	$('hint').textContent = state.phase !== 'active' ? 'Teacher has ' + state.phase + ' this round.' : editing ? 'Arrange all 40 pieces in your four rows. Lock when ready.' : m.phase === 'setup' ? 'Formation locked. Waiting for opponent.' : m.phase === 'over' ? (m.winner === m.side ? 'Victory!' : 'Match complete — opponent wins.') : m.turn === m.side ? 'Your turn' : 'Opponent’s turn';
	$('board').replaceChildren();
	for (let screen = 0; screen < 100; screen++) {
		const i = m.side === 0 ? screen : 99 - screen;
		let p = m.board[i];
		if (editing) {
			const k = m.side === 0 ? i - 60 : 39 - i;
			if (k >= 0 && k < 40)
				p = {
					side: m.side, rank: formation[k]
				};
		}
		const b = document.createElement('button'), lake = [42, 43, 46, 47, 52, 53, 56, 57].includes(i);
		b.className = (lake ? 'lake' : p ? 'p' + p.side : '') + (selected === i ? ' selected' : '');
		b.textContent = lake ? '≈' : p ? (p.rank === '?' ? '?' : p.rank + ' ' + names[p.rank]) : '';
		b.setAttribute('aria-label', 'Square ' + i + (p ? ' ' + (p.side === m.side ? 'your ' : 'opponent ') + (names[p.rank] || 'hidden piece') : lake ? ' lake' : ' empty'));
		b.disabled = lake;
		b.onclick = () => action(async () => {
			if (editing) {
				const k = m.side === 0 ? i - 60 : 39 - i;
				if (k < 0 || k >= 40)
					return;
				if (selected < 0)
					selected = i;
				else {
					const a = m.side === 0 ? selected - 60 : 39 - selected;
					[formation[a], formation[k]] = [formation[k], formation[a]];
					selected = -1;
				}
				render();
				return;
			}
			if (state.phase !== 'active' || m.phase !== 'play' || m.turn !== m.side)
				return;
			if (p?.side === m.side) {
				selected = i;
				render();
				return;
			}
			if (selected < 0)
				return;
			const move = {
				from: selected, to: i, seq: m.seq
			};
			if (!pending || pending.from !== move.from || pending.to !== move.to || pending.seq !== move.seq)
				pending = {
					...move, requestId: crypto.randomUUID()
				};
			state = await api('move', pending);
			pending = null;
			selected = -1;
			render();
		});
		$('board').append(b);
	}
	$('events').replaceChildren();
	for (const e of m.events) {
		const li = document.createElement('li');
		li.textContent = e.text;
		$('events').append(li);
	}
}
$('legend').textContent = Object.entries(names).map(([r, n]) => r + ' ' + n + ' ×' + counts[r]).join(' · ');
setInterval(async () => {
	if (busy)
		return;
	try {
		if (teacherToken)
			renderTeacher(await api('teacher/state', {}, teacherToken));
		else if (token) {
			state = await api('state');
			render();
		}
	}
	catch (e) {
		err(e);
	}
}, 1000);
let facts = await (await fetch('/facts.json')).json(), fact = 0, paused = false;
function showFact() {
	$('factText').textContent = facts[fact].text;
	$('factSource').href = facts[fact].url;
	$('factSource').textContent = facts[fact].source;
}
$('nextFact').onclick = () => {
	fact = (fact + 1) % facts.length;
	showFact();
};
$('pauseFact').onclick = () => {
	paused = !paused;
	$('pauseFact').textContent = paused ? 'Resume' : 'Pause';
};
setInterval(() => {
	if (!paused && !document.hidden) {
		fact = (fact + 1) % facts.length;
		showFact();
	}
}, 20000);
showFact();
$('playroomRetry').onclick = () => location.reload();
