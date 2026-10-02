# Projector UI release verification

Unity 6000.5.2f1 WebGL build `Builds/ProjectorUIRelease` completed successfully. Build log: `Logs/projector-ui-build.log`.

- 236 tests passed, zero failures (`Logs/projector-ui-tests.log`).
- Actual Unity local browser fixtures passed: neutral spectator default, Neutral -> Union -> Confederate -> Neutral cycle, authority-redacted ranks/selection/targets, public combat visibility, unchanged match sequence and no spectator acknowledgements.
- Internal `Toggle Zoom` works in player and spectator views; there is no webpage duplicate. Touch-emulated portrait and landscape setup swaps passed; pause blocked swaps and return to normal passed.
- Strategy tip and 15-second reminder were captured alongside friendly messages with separate readable top panels. The 30-second deadline notice uses the same top renderer; deadline timing and acknowledgement rules remain unchanged.
- Inspected final screenshots: `Logs/neutral-focused.png`, `neutral-cycle-return.png`, `neutral-internal-toggle.png`, `neutral-public-combat.png`, `focus-portrait.png`, `focus-landscape.png`, `top-tip-friendly.png`, `top-reminder-friendly.png`. Initial neutral capture preceded board rendering; subsequent normal-view capture confirms the rendered board.
- No browser exceptions in final fixture results. No live Playroom identities created; fixtures use local authority and isolated task-owned browsers, closed on completion.

Physical-phone testing remains manual. This release does not change classroom credentials or the previously published new-class seat isolation fix. Existing live user sessions are not modified by these tests.
