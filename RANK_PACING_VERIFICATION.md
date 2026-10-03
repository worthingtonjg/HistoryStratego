# Rank occlusion and pacing verification

## Rank overlap

The rank TextMesh was correctly parented to its pawn, at local height 0.31 above the face, but used Unity's `GUI/Text Shader`. It rendered through opaque geometry. Both factions and both normal/zoom renders reproduced this: 241 normal-view or 183 zoom-view text pixels remained visible behind a fully covering opaque object. The new board-only `History/BoardRank` shader uses `ZTest LEqual`, transparent glyph blending, and no depth writes. Corrected renders showed zero text pixels through that object; uncovered ranks remained visible. The font atlas follows font texture rebuilds. Lift height, rank visibility rules, artwork, and the separate upright combat materials are unchanged.

Evidence: `tests/board-rank-render.cs`, `Logs/board-rank-render.log`, and before/after frames in `Logs/RankDepth/`. Actual WebGL checks use `tests/rank-overlap-browser.mjs`.

## Ordinary moves and NPC pacing

Local previews already took 350 ms. Received ordinary moves instead waited 350 ms and slid for 1200 ms. They now use the same 350 ms duration and SmoothStep easing as previews, without the extra hold. Combat approach timing is unchanged. Confirmed own previews still suppress duplicate animation; rejected/stale commands still restore authoritative state.

The NPC previously thought for 1200 ms initially or 2400 ms thereafter, imposed a 4000 ms cooldown, and waited for the two-second turn banner. Thinking is now 300 ms, the extra cooldown is removed, and an ordinary move's nonblocking banner does not delay the NPC. Setup and timeout notices, phase/turn legality, selection revalidation, and combat barriers remain enforced.

Active noncombat student polling is 250 ms in solo and 500 ms in multiplayer, rather than 1000 ms. Requests remain serialized; teacher/lobby/combat polling stays unchanged. This modestly increases multiplayer read traffic. Network and browser frame latency still apply; no local turn permission is fabricated.

Final headless Unity solo test: human confirmation 179 ms after click; NPC confirmation 453 ms later; received slide completed in 389 ms including frame granularity, against the 350 ms target. Another 853 ms elapsed before that animation began in this software-rendered run, so the nominal poll interval is not a guarantee of end-to-end latency. Both moves were unique and turn returned to the human. Evidence: `Logs/pacing-solo-result.json`.

## Three-second combat countdown

The existing auto-continue countdown changes from **five to three active seconds after the 2.3-second combat animation is ready**. This is not a three-second total for the entire approach, animation, and reveal. Manual continue still works; each player acknowledges only their own side and both are required. Teacher pause suspends the countdown. The NPC's own combat review is three seconds rather than eight. The 30-second turn clock and five-minute setup clock are unchanged. No cutscene toggle was added.

Sixteen focused Node tests passed: first NPC moves for both factions/manual and expired setup, solo guards, and three-second continuation permissions/pause/end/barrier behavior. Actual Unity tests passed reload during combat, teacher pause/resume, manual acknowledgments, lowering the survivor, and rendered-ready auto-continuation while both browser pages were frozen. Frozen-browser evidence: `docs/evidence/background-continue-1790989369018/result.json` (local ignored evidence).

Unity 6000.5.2f1 WebGL build `Builds/RankPacingRelease` succeeded with exit 0. All tests used local fixtures, with Playroom blocked; no new live identities or classroom resets occurred.
