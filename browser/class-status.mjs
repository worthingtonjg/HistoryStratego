// Only a transport-confirmed classroom retirement invites a student to leave.
export function renderClassState(value, message, next, game = null, ended = null) {
 if (value?.classRetired === true || value?.removed === true || ended?.hidden === false) {
  if (next) next.hidden = false;
  if (game) { game.hidden = true; game.inert = true; }
  if (ended && ended.hidden) { ended.hidden = false; ended.focus?.(); }
  if (message) message.textContent = value?.removed === true ? 'You were removed from this classroom by your teacher.' : 'Class ended. Ask your teacher for the next code.';
  if (value?.removed === true && ended?.querySelector) {
   ended.querySelector('h1').textContent = 'You were removed';
   ended.querySelector('p').textContent = 'Your teacher removed you from this classroom. Ask your teacher before joining again.';
   ended.querySelector('button').textContent = 'Return to class entry';
  }
 } else if (['waiting', 'active', 'paused', 'ended'].includes(value?.phase)) {
  if (next) next.hidden = true;
  if (message && (message.textContent.startsWith('Class ended') || message.textContent.startsWith('Round ended'))) {
   message.textContent = value.phase === 'ended' ? 'Round ended. Waiting for your teacher.' : 'Connected to host';
  }
 }
}