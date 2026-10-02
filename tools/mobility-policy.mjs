// Bounded empty-square connectivity only: enemy identities/ranks are never consulted.
const lakes = new Set([42, 43, 46, 47, 52, 53, 56, 57]);
const adjacent = i => [i - 10, i + 10, ...(i % 10 ? [i - 1] : []), ...(i % 10 < 9 ? [i + 1] : [])].filter(j => j >= 0 && j < 100 && !lakes.has(j));
const enemyHalf = (i, side) => side === 0 ? i < 50 : i >= 50;
export function reachableFrontier(board, side) {
	const reachable = new Set(), queue = [];
	for (let i = 0; i < 100; i++)
		if (!lakes.has(i) && !board[i] && (enemyHalf(i, side) || adjacent(i).some(j => board[j]?.side === 1 - side))) {
			reachable.add(i);
			queue.push(i);
		}
	for (let at = 0; at < queue.length; at++)
		for (const next of adjacent(queue[at]))
			if (!board[next] && !reachable.has(next)) {
				reachable.add(next);
				queue.push(next);
			}
	return reachable;
}
const connected = (at, side, reachable) => enemyHalf(at, side) || adjacent(at).some(i => reachable.has(i));
export function quietMoveMobility(board, side, from, to, before = reachableFrontier(board, side)) {
	if (board[to])
		return {
			kind: 'interaction', adjustment: 0
		};
	const afterBoard = board.slice();
	afterBoard[to] = afterBoard[from];
	afterBoard[from] = null;
	const after = reachableFrontier(afterBoard, side);
	// Moving a blocker can help a different friendly mobile piece, even if it moves sideways/backwards.
	let opensRoute = false;
	for (let i = 0; i < 100; i++)
		if (i !== from && board[i]?.side === side && !['B', 'F'].includes(board[i].rank) && !connected(i, side, before) && connected(i, side, after)) {
			opensRoute = true;
			break;
		}
	if (opensRoute)
		return {
			kind: 'opens-friendly-route', adjustment: 8
		};
	if (!connected(to, side, after))
		return {
			kind: 'blocked-pocket', adjustment: -40
		};
	return {
		kind: 'reachable-frontier', adjustment: 0
	};
}
