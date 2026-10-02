// Same seeded algorithm as ArmyFormation.cs; indices are relative to the owner's
// front row (0..9) through back row (30..39). No opponent state is an input.
export function generateFormation(seed = crypto.getRandomValues(new Uint32Array(1))[0]) {
	let state = (seed >>> 0) || 0x6d2b79f5;
	const next = n => {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		return Math.floor((state >>> 0) / 4294967296 * n);
	};
	const shuffle = a => {
		for (let i = a.length - 1; i > 0; i--) {
			const j = next(i + 1);
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	};
	const ranks = ['F', 'B', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], counts = [1, 6, 1, 8, 5, 4, 4, 4, 3, 2, 1, 1], cells = Array(40).fill(null);
	const column = next(10), flag = 30 + column;
	cells[flag] = 'F';
	cells[flag - 10] = 'B';
	if (column > 0)
		cells[flag - 1] = 'B';
	if (column < 9)
		cells[flag + 1] = 'B';
	for (const i of shuffle(Array.from({
		length: 10
	}, (_, i) => i)).slice(0, 8))
		cells[i] = '2';
	const bag = [];
	for (let i = 0; i < ranks.length; i++)
		for (let n = cells.filter(r => r === ranks[i]).length; n < counts[i]; n++)
			bag.push(ranks[i]);
	shuffle(bag);
	let cursor = 0;
	for (let i = 0; i < 40; i++)
		if (cells[i] === null)
			cells[i] = bag[cursor++];
	return cells;
}
