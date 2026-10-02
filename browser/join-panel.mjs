export const STUDENT_PORTAL = 'https://worthingtonjg.github.io/HistoryStratego/';
// This controller only reads the current public code and changes dialog UI; it has no game commands.
export function installJoinPanel({ button, dialog, codeElement, urlElement, closeButton, getCode }) {
	urlElement.href = STUDENT_PORTAL;
	urlElement.textContent = STUDENT_PORTAL;
	button.addEventListener('click', () => {
		const code = getCode();
		if (!code)
			return;
		codeElement.textContent = code;
		if (!dialog.open)
			dialog.showModal();
	});
	closeButton.addEventListener('click', () => dialog.close());
	dialog.addEventListener('close', () => button.focus());
}
