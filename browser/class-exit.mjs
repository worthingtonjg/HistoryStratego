export function createClassExit({ getRuntime, isAllowed, confirm, storage, navigate, onPending, onError }) {
	let pending = false;
	return async function exitClass(createNext) {
		const runtime = getRuntime();
		if (pending || !isAllowed() || runtime?.role !== 'teacher')
			return false;
		const message = createNext ? 'End this class for every student and create a fresh classroom? The old code will stop working.' : 'End this classroom? All games will end and the current class code will stop working. Students cannot rejoin this class. No new classroom will be created.';
		if (!confirm(message))
			return false;
		pending = true;
		onPending();
		try {
			await runtime.retire();
			storage.removeItem('history.browserSession');
			if (createNext)
				storage.setItem('history.newClass', '1');
			else
				storage.removeItem('history.newClass');
			navigate();
			return true;
		}
		catch (error) {
			pending = false;
			onError(error);
			return false;
		}
	};
}
