// Convenience flow gate only. Deliberate JavaScript modification is outside its protection.
const approvals = new WeakSet();
export function acceptUnityTeacherGate() {
	const approval = {};
	approvals.add(approval);
	return approval;
}
export function requireTeacherAccess(approval) {
	if (!approval || !approvals.has(approval))
		throw Error('Open the teacher page and unlock it in Unity first.');
}
