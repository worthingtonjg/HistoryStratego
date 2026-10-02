# Phased formation and NPC verification

Prepared locally; not published. Build: `Builds/PhasedFormationRelease` using Unity 6000.5.2f1. Build completed with return code 0 (`Logs/phased-formation-build.log`). Browser package: `Builds/PhasedFormationPreview/docs`.

Students progress through Place Flag, Place Bombs, and Place Remaining Pawns. The Flag starts in a random back-row square; six Bombs fill random empty squares on Next. Final fill preserves every occupied square and puts as many Scouts as possible on available front-row squares, then places the remaining inventory randomly. Students may move any already placed piece, including earlier-phase Flag/Bombs. Final Ready locks the formation; optional Shuffle pawns preserves Flag/Bomb squares.

The same five-minute deadline spans all phases and is displayed as minutes:seconds. Timeout preserves all currently placed pieces and fills only missing inventory. Phase, draft, revision and deadline survive reconnect/checkpoint recovery; legacy full-draft checkpoints are treated as final-phase drafts. Pause freezes the countdown; readiness still waits for both armies.

NPCs use the original full shuffle and bypass guided placement through teacher-authorized commands. Actual NPC metadata persists in checkpoints and appears only in teacher roster/spectator projections. Teacher lists and relevant spectator labels append (NPC); student-facing names are unchanged.

Validation:
- 38 focused setup/shuffle/swap/NPC/transport tests passed, including 256 seeded partial-fill inventories, front-row conflicts, timeout at each phase, stale action rejection, reconnect, pause/end, mixed student/NPC readiness, and the actual browser NPC controller. `Logs/phased-focused-tests.log`.
- Actual Unity walkthrough passed for both player orientations: move Flag to empty square, phase transitions, move earlier pieces in later phases, delayed-response swap preview, phase-two reload, shared deadline, paused-swap rejection, Ready and NPC opponent readiness. Latest result: `Logs/phased-visual-result.json`; zero browser exceptions in `Logs/phased-unity-result.json`.
- Actual teacher Unity cards/Spectate verified (NPC), full names, pairing/removal behavior and no student marker leakage. `Logs/npc-teacher-unity-result.json` and `Logs/npc-teacher-actions.json`.
- Inspected screenshots: `Logs/phase1-normal.png`, `phase2-normal.png` (3:59), `phase2-reload.png`, `phase3-normal.png`, `phase-ready.png`, `npc-teacher-wide.png`, `npc-teacher-spectate.png`.

No live Playroom identities were created; isolated local fixtures were closed. Physical phone testing was not run for this batch. Publication remains pending authorization for these new formation/NPC changes; the currently published teacher-card release is unchanged.
