# NPC duel pacing and earned Miner hunting

## Changes

- Both-NPC matches expose a nonsecret npcDuel boolean in each participant's redacted state. Only these matches add a one-second minimum gap after a turn becomes actionable. Existing 300 ms thinking/polling remain; human-versus-NPC timing is unchanged.
- No next decision while combat is pending. Both acknowledgments must clear before the gap begins. Overlapping policy ticks return without issuing duplicate requests. Commands preserve the original sequence/match and acknowledgments target the reviewed battle. The previous browser adapter replaced the planned sequence with a fresh sequence; that sequencing risk is fixed, without claiming it was the cause of the user's specific live symptom.
- An observed Miner victory over a Bomb in either enemy rear row unlocks back-row hunting for that survivor only. Unknown, strong, Flag and other enemy back-row targets are permitted. Other Miners and targets outside that row keep the default whitelist. Movement lineage, death and reconnect are covered; no hidden rank reads.

## Passed checks

58 focused tests: NPC duel ordinary turns, combat barriers, overlapping ticks/stale decisions, unchanged human pacing, both-faction Miner triggers on both rear rows, non-trigger cases, fallback whitelist, lineage/death/reconnect, NPC startup, phased setup and solo persistence. Logs/npc-duel-final-tests.log.

Real isolated Chrome browser controllers completed four consecutive ordinary moves at sequences 1,2,3,4. Measured gaps were 2244, 2273 and 2234 ms, including polling and thinking. Combat fixture completed sequences 1,2; its next move occurred 2553 ms after the final combat acknowledgment. No browser exceptions. Logs/npc-duel-browser-result.json. These are local fixtures, not the user's live game.

JavaScript-only release; the previously verified MinerTurnRelease Unity WebGL binaries are unchanged. No new Playroom identities or live match actions. Existing open authority/controller tabs require refresh to adopt the new code. Browser scheduling can lengthen the minimum pause, especially in background tabs.
