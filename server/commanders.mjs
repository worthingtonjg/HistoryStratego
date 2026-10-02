// Public historical profiles only. Assignment never depends on hidden army ranks.
import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
export const COMMANDERS = JSON.parse(readFileSync(new URL('./commanders.json', import.meta.url), 'utf8')).map(c => ({
	...c, faction: c.side, side: c.side === 'Union' ? 1 : 0, name: c.displayName, summary: c.profile, strategy: c.battleExample, sourceTitle: c.sourceUrl.includes('archives.gov') ? 'National Archives' : c.sourceUrl.includes('loc.gov') ? 'Library of Congress' : 'National Park Service'
}));
export const PRESENCE_GRACE_MS = 90000;
export function seatAvailable(p, now) {
	return now - p.lastSeen <= PRESENCE_GRACE_MS;
}
export function assignCommander(students, pool = COMMANDERS, now = Date.now()) {
	const used = new Set([...students.values()].map(p => p.commander?.id));
	const counts = [0, 0];
	for (const p of students.values())
		if (seatAvailable(p, now))
			counts[p.commander.side]++;
	const side = counts[0] <= counts[1] ? 0 : 1;
	const available = pool.filter(c => c.side === side && !used.has(c.id));
	if (!available.length)
		throw Error('No unused commander is available for the balancing faction. The teacher must open a new classroom; existing aliases are reserved for reconnect.');
	return structuredClone(available[randomInt(available.length)]);
}
export function pairRoster(order, students, shuffle, now) {
	const sides = [[], []], waiting = [];
	for (const id of order) {
		const p = students.get(id);
		if (!p?.commander || ![0, 1].includes(p.commander.side))
			throw Error('A seat has no valid faction assignment.');
		if (seatAvailable(p, now))
			sides[p.commander.side].push(id);
		else
			waiting.push(id);
	}
	const red = shuffle(sides[0]), blue = shuffle(sides[1]), count = Math.min(red.length, blue.length), paired = [];
	for (let i = 0; i < count; i++)
		paired.push(red[i], blue[i]);
	return {
		order: [...paired, ...red.slice(count), ...blue.slice(count), ...waiting], pairedCount: paired.length
	};
}
