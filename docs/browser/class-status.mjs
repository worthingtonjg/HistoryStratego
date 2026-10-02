// Only a transport-confirmed classroom retirement invites a student to leave.
export function renderClassState(value, message, next, game = null, ended = null) {
 if (value?.classRetired === true || ended?.hidden === false) {
  if (next) next.hidden = false;
  if (game) { game.hidden = true; game.inert = true; }
  if (ended && ended.hidden) { ended.hidden = false; ended.focus?.(); }
  if (message) message.textContent = 'Class ended. Ask your teacher for the next code.';
 } else if (['waiting', 'active', 'paused', 'ended'].includes(value?.phase)) {
  if (next) next.hidden = true;
  if (message && (message.textContent.startsWith('Class ended') || message.textContent.startsWith('Round ended'))) {
   message.textContent = value.phase === 'ended' ? 'Round ended. Waiting for your teacher.' : 'Connected to teacher';
  }
 }
}