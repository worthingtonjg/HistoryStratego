# Rolling history and Miner approach safety

## Behavior

- Both player and teacher logs retain the most recent 20 move/combat events (plus a terminal status message when applicable). Sequence numbers, current board, turn, outcome, capture totals, setup and clocks are preserved.
- Each player's legitimately observed enemy ranks, remembered bombs, enemy Spy death, tracked Miner identities, earned hunts, assignment and Spy target, visits and six recent ordinary moves persist independently of the display log. Only that player's own observation memory appears in their projection. No unrevealed enemy rank is consulted by the policy.
- Combat records are separate from the rolling log, preserving acknowledgments, delayed review, tutorial observations and deterministic banter. Their count is bounded by the original 80 pieces because every combat removes at least one piece. Recovery relinks pending combat to its acknowledgment record.
- Legacy full-history checkpoints migrate before trimming. Existing solo controller memory is seeded into migration. Classroom controllers now checkpoint their current policy memory; timeout controllers preserve their memory too. No classroom reset is required.
- Keep 128 move-request receipts. Recent identical retries stay idempotent; older retries are rejected by sequence validation, never reapplied.
- All archived match results are preserved. After 40 fully reviewed detailed archives, older archives become compact result summaries retaining participants, commanders, sequence, winner, capture totals and ending reason. Unresolved combat is not retired. Compact result summaries can still grow with the number of rounds; there is no silent result-deletion cap.
- Before earning its rear-row hunt, a Miner pursuing a remembered Bomb cannot step onto a square where a legitimately known rank 3-10 can kill it next turn. The gate applies before preferred, fallback and emergency pools, including NPC timeouts. Bomb-disarming attacks may enter danger. Earned back-row hunting retains its existing exception. Unknown ranks remain unknown; this is not a guarantee against concealed threats. A Scout (rank 2) cannot kill a defending Miner (rank 3), even along an open Scout lane.
- A blocked NPC waits or takes a safe alternative. No skipped turn or fabricated defeat is introduced; human move legality is unchanged.

## Verified locally

- Unity 6000.5.2f1 WebGL: `Builds/HistoryMemoryRelease`, `Logs/history-memory-build.log`, exit 0. Generated private teacher build resource removed on completion.
- `npm test`: 292 passed, zero failed/skipped (`Logs/history-final-tests.log`). Includes legacy migration with identical next decisions for both factions, 1,200 moves, bounded receipts, redaction, both Miner hunts, known ranks/Spy death, delayed combat outside the tail, archive summaries, safe detours, risky disarm and timeout refusal. Stale tests were aligned with already-existing three-second combat delay, strict Miner fallback and current commander-card labels.
- `node tests/transport-large-browser.mjs`: isolated real Chrome, no live Playroom identities. AES-GCM payload round trips up to 5 MiB; compact 1,200-move classroom checkpoint was 22,459 stored characters, recovered paused with the same player, then continued at sequence 1,201. The log retained 20 moves (`Logs/transport-large-browser-result.json`).
- `node tests/history-unity-browser.mjs`: actual Unity WebGL at 1920x860; rolling log visible, 80-move missed-update gap handled, reload successful, old unread combat rendered with banter despite falling outside the log. Nine state reads, sequence 122, no browser exceptions (`Logs/history-unity-result.json`). Screenshots inspected: `Logs/history-unity-log.png` and `Logs/history-unity-pending-combat.png`.
- Packaged browser release: `HISTORY_VISUAL_BUILD=Builds/HistoryMemoryPublic/docs node tests/solo-browser.mjs` passed actual Unity intro, three setup stages, reload, zoom, offline human/NPC moves, Flag combat, win, replay and return preserving the separate classroom identity. Playroom blocked, no external fetches or browser exceptions (`Logs/solo-browser-result.json`).
- All tests used isolated fixtures. The user's current browser, match, credentials and site storage were not inspected or modified. Live SDK connectivity and classroom authentication were unchanged and were not retested using new identities.

## Recovery

After deployment, refresh the existing teacher page in the same browser profile and unlock normally. Recovery of the existing classroom pauses it; inspect before Resume. Do not clear site data or create a replacement class merely to obtain this update. Migration can only recover the last successfully saved checkpoint, not moves that were never saved by the earlier version.

Publication evidence is recorded separately in `Logs/history-memory-deployment.json`, verifying the exact public commit, successful Pages run and served asset SHA256 hashes.
