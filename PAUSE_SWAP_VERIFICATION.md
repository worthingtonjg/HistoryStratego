# Pause panel and formation swap verification

Unity 6000.5.2f1 built PauseSwapFinal successfully. All 200 automated tests passed, including confirmed-exchange checks rejecting stale, invalid and unrelated snapshots.

Actual Unity WebGL, isolated local authority fixture:
- Pause panel stayed visible after mouse input and Escape.
- Reload into paused state restored the panel after Unity consumed fresh state.
- Resume removed it; end round removed it and returned the waiting screen.
- Paused formation setup showed the same persistent panel.
- A confirmed formation exchange dispatched once and exchanged the expected ranks. Inspected captures show both pieces between squares, followed by the final authoritative arrangement.

The student-only pause panel cannot be dismissed and takes priority over turn/message notices. Teacher controls remain outside this overlay. Existing pause authority and clocks are unchanged.

Formation exchanges animate for 350 ms only after a successful matching revision response. Only the student's own draft is animated; normal gameplay movement is unchanged. Further formation actions wait during the short animation. Phase, readiness, revision, match and deadline changes cancel the visual transition and restore authoritative positions.

No current user classroom was paused or reset. This pass used one isolated Unity browser at a time; no ten-player load test or broad multiplayer visual regression was run. Broader classroom QA remains manual.
The browser banner now requires an explicit transport-confirmed classRetired flag. End-round snapshots no longer show Join next class, and subsequent active/waiting snapshots clear stale end notices. Regression tests cover round end, next round, paused/waiting state, genuine retirement and unrelated errors.
