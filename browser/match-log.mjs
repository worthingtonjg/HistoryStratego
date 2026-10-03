function square(index) {
	return Number.isInteger(index) && index >= 0 && index < 100 ? String.fromCharCode(65 + index % 10) + (Math.floor(index / 10) + 1) : '';
}
export function publicLogRows(match) {
	return (match?.events || []).map(event => ({
		seq: event.seq, kind: event.kind || 'dispatch', text: event.text || '', actor: Number.isInteger(event.side) ? match.playerNames?.[event.side] || 'Player' : '', from: square(event.from), to: square(event.to)
	}));
}
export function createLogController({ read, render, show, hide }) {
	let selected = '', generation = 0;
	async function load(id) {
		const mine = ++generation;
		selected = id;
		render({
			loading: true, rows: []
		});
		show();
		try {
			const result = await read(id);
			if (mine !== generation || selected !== id)
				return;
			if (result.error)
				throw Error(result.error);
			render({
				title: (result.match?.playerNames || []).join(' vs '), rows: publicLogRows(result.match)
			});
		}
		catch (error) {
			if (mine === generation)
				render({
					error: error.message, rows: []
				});
		}
	}
	return {
		open: load, refresh: () => selected ? load(selected) : Promise.resolve(), close() {
			generation++;
			selected = '';
			render({
				rows: []
			});
			hide();
		}
	};
}
export function installMatchLog({ dialog, title, list, closeButton, refreshButton, request, document }) {
	const controller = createLogController({
		read: id => request('teacher/spectate', {
			matchId: id
		}), show: () => {
			if (!dialog.open)
				dialog.showModal();
		}, hide: () => {
			if (dialog.open)
				dialog.close();
		}, render: value => {
			title.textContent = value.title ? 'Recent 20 moves: ' + value.title : 'Recent 20 moves';
			list.replaceChildren();
			if (value.loading || value.error) {
				list.textContent = value.error || 'Loading retained events...';
				return;
			}
			if (!value.rows.length) {
				list.textContent = 'No recorded moves yet.';
				return;
			}
			for (const row of value.rows) {
				const item = document.createElement('p');
				item.textContent = '#' + row.seq + ' ' + row.kind.toUpperCase() + (row.actor ? ' | ' + row.actor : '') + (row.from ? ' | ' + row.from + ' → ' + row.to : '') + ' — ' + row.text;
				list.append(item);
			}
		}
	});
	closeButton.addEventListener('click', () => controller.close());
	refreshButton.addEventListener('click', () => controller.refresh());
	dialog.addEventListener('cancel', () => controller.close());
	return controller;
}
