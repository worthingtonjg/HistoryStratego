const CURRENT = 'history.teacher.current';
export const retiredKey = code => 'history.teacher.retired.' + code;
export function isRetired(code) {
	return !!localStorage.getItem(retiredKey(code));
}
export function rememberClassroom(code, recovery) {
	if (isRetired(code))
		throw Error('Class ended. Create a new classroom.');
	localStorage.setItem(CURRENT, JSON.stringify({
		code, recovery
	}));
}
export function currentClassroom() {
	let value;
	try {
		value = JSON.parse(localStorage.getItem(CURRENT) || 'null');
	}
	catch {
		return null;
	}
	return value?.code && value?.recovery && !isRetired(value.code) ? value : null;
}
export function retireClassroom(code) {
	let rooms;
	try {
		rooms = JSON.parse(localStorage.getItem('history.teacher.retiredRooms') || '[]');
	}
	catch {
		rooms = [];
	}
	localStorage.setItem('history.teacher.retiredRooms', JSON.stringify([...new Set([...rooms, code.split('-')[0]])]));
	localStorage.setItem(retiredKey(code), JSON.stringify({
		retiredAt: new Date().toISOString()
	}));
	const current = currentClassroom();
	// Tombstones and encrypted checkpoints are retained; only the active pointer is cleared.
	if (!current || current.code === code)
		localStorage.removeItem(CURRENT);
}
export function retiredRoom(room) {
	try {
		return JSON.parse(localStorage.getItem('history.teacher.retiredRooms') || '[]').includes(room);
	}
	catch {
		return false;
	}
}
