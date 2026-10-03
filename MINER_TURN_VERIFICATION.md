# Miner strategy, setup, turn notice and repetition update

## Behavior

- Repeated back-and-forth moves are legal. Authority, cached highlights and Unity automatic selection agree. The NPC still prefers productive moves.
- Known-bomb pursuit first prefers safe routes, then permits purposeful approaches past unknown adjacent defenders. Enemy ranks are never inspected. A dead assigned Miner is replaced when another can reach a remembered bomb.
- NPC Miners attack only genuinely known 1, 2 or Bomb, including fallback and timeout decisions. No Flag exception. Human combat legality is unchanged. If only policy-forbidden attacks remain, the NPC waits and its timer restarts; this is not defeat.
- Marshals pursue known 2-9. They avoid known Spy/Bomb attacks and only trade with a known 10 after observing the enemy Spy die. Own Spy death does not count. Unknown-target risk and Flag capture priority remain unchanged.
- Full shuffle prioritizes all five Miners in random available back-row squares. Phase-three/timeout fill preserves existing choices, fills available back-row slots with remaining Miners, then falls back to other empty cells. Scouts retain front-row priority. Explicit remaining-piece shuffle preserves Flag/Bombs.
- The two-second Your Turn banner uses the common top notice area in normal/zoom mode. Tips take precedence; friendly messages occupy a separate slot; the board is not moved. Turn logic and input remain unchanged.

## Verification

Unity 6000.5.2f1 WebGL build succeeded: Logs/miner-turn-release-build.log, exit 0; Builds/MinerTurnRelease. Generated teacher build resource was removed.

107 aggregate tests passed (Logs/miner-turn-tests.log), plus two authority integration cases passed with the strict policy tests. Coverage includes 24 bounded seeded bomb pursuits, hidden-rank getters that throw on access, both factions, 256 matching C#/JS shuffle vectors, crowded/empty back rows, preserved formation choices, phased setup/timeouts, multiple repeated traversals with authority/highlight parity, combat/teacher controls, NPC startup and solo persistence.

Four actual Unity WebGL top-notice/friendly-message screenshots captured and inspected: desktop normal 1600x900, phone normal 390x844, phone zoom 390x844 and landscape zoom 844x390. No browser exceptions or combat acknowledgments. Evidence: Logs/turn-top-result.json and Logs/turn-top-*.png. Phone normal view retains the existing scaled desktop layout; zoom gives readable phone-sized text.

All browser checks used isolated loopback fixtures with Playroom blocked. No new live identities, user match moves, accounts or services. Existing flag-entry behavior is retained. The strict policy can deliberately hold when no permitted move exists; it does not claim a no-legal-move victory in that situation.
