export const randomUUID = () => crypto.randomUUID();
export function randomBytes(n) {
	const a = crypto.getRandomValues(new Uint8Array(n));
	return {
		toString: () => Array.from(a, x => x.toString(16).padStart(2, '0')).join('')
	};
}
export function randomInt(n) {
	const limit = Math.floor(4294967296 / n) * n;
	let x;
	do {
		x = crypto.getRandomValues(new Uint32Array(1))[0];
	} while (x >= limit);
	return x % n;
}
