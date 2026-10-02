import test from 'node:test';
import assert from 'node:assert/strict';
import { publicLogRows, createLogController } from '../browser/match-log.mjs';
import { createAuthority } from '../server/server.mjs';
test('log projection excludes concealed ranks, board, targets and acknowledgments', () => {
	const rows = publicLogRows({
		playerNames: ['A', 'B'], board: [{
			rank: '10'
		}], events: [{
			seq: 1, kind: 'move', side: 0, text: 'Piece moves', from: 60, to: 50, moving: '10', targets: [{
				rank: 'B'
			}], ack: [false, false]
		}, {
			seq: 2, kind: 'combat', side: 1, text: 'Miner attacks Bomb: attacker wins', from: 40, to: 50, attacker: '3', defender: 'B'
		}]
	});
	assert.equal(rows[0].from, 'A7');
	assert.equal(rows[0].to, 'A6');
	assert.deepEqual(Object.keys(rows[0]).sort(), ['actor', 'from', 'kind', 'seq', 'text', 'to']);
	assert(rows[1].text.includes('Miner attacks Bomb'));
});
test('closing or switching log suppresses stale replies and clears prior match events', async () => {
	const pending = new Map(), rendered = [];
	let opened = 0, closed = 0;
	const c = createLogController({
		read: id => new Promise(resolve => pending.set(id, resolve)), render: x => rendered.push(x), show: () => opened++, hide: () => closed++
	});
	const first = c.open('a');
	const second = c.open('b');
	pending.get('a')({
		match: {
			playerNames: ['old'], events: [{
				text: 'old'
			}]
		}
	});
	await first;
	assert(!rendered.some(x => x.title === 'old'));
	pending.get('b')({
		match: {
			playerNames: ['new'], events: []
		}
	});
	await second;
	assert.equal(rendered.at(-1).title, 'new');
	const late = c.refresh();
	c.close();
	pending.get('b')({
		match: {
			playerNames: ['stale'], events: []
		}
	});
	await late;
	assert(!rendered.some(x => x.title === 'stale'));
	assert.equal(closed, 1);
	assert.equal(rendered.at(-1).rows.length, 0);
});
test('teacher log source reads retained events without changing game, acknowledgment or viewpoint', () => {
	const a = createAuthority({
		teacherKey: 'fixture-only', classCode: 'LOG', now: () => 1000, timedSetup: false, timedTurns: false
	});
	a.call('join', {
		classCode: 'LOG'
	});
	a.call('join', {
		classCode: 'LOG'
	});
	a.call('teacher/start', {}, 'fixture-only');
	const m = [...a.matches.values()][0];
	m.events = [{
		seq: 1, kind: 'combat', side: 0, text: 'Miner attacks Bomb: attacker wins', from: 60, to: 50, attacker: '3', defender: 'B', ack: [false, false]
	}];
	m.reveal = m.events[0];
	a.call('teacher/spectate', {
		matchId: m.id, perspective: 'blue'
	}, 'fixture-only');
	const before = JSON.stringify({
		board: m.board, turn: m.turn, seq: m.seq, events: m.events, reveal: m.reveal, choices: [...a.__perspectiveChoices]
	});
	const snapshot = a.call('teacher/spectate', {
		matchId: m.id
	}, 'fixture-only');
	assert.equal(publicLogRows(snapshot.match).length, 1);
	assert.equal(JSON.stringify({
		board: m.board, turn: m.turn, seq: m.seq, events: m.events, reveal: m.reveal, choices: [...a.__perspectiveChoices]
	}), before);
	assert.throws(() => a.call('teacher/spectate', {
		matchId: m.id
	}, 'student'), /Teacher/);
});
