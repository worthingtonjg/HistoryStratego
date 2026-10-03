# Move feedback and board attack verification

Moves to an authority-supplied legal destination now start a local visual preview immediately. An ordinary move travels in 350 ms while awaiting confirmation; an attack only approaches slightly and shows a pending label. The preview never changes rank knowledge, board state, outcome, or turn. Confirmation avoids replaying the same ordinary move animation. Rejection, a changed position/context, or connection failure restores the authoritative view. Further destination clicks are blocked while pending.

Confirmed main-board attackers rise 0.4 units above the defender before overlapping and remain raised throughout the reveal. After both acknowledgments, surviving attackers lower over 350 ms; losing attackers disappear and ties remove both. The separate upright cutscene is unchanged. No cutscene checkbox was added.

## Evidence

- Unity 6000.5.2f1 final WebGL build succeeded (exit 0): `Builds/MovePreviewRelease`, `Logs/move-preview-build.log`.
- `tests/move-preview-visual.mjs --baseline`: with a 1400 ms delayed state response and 900 ms delayed move response, request arrived 1429 ms after click, confirmation arrived at 2337 ms, then the old renderer imposed its 350 ms hold (approximately 2687 ms before movement).
- `tests/move-preview-visual.mjs`: all ten actual Unity cases passed across both factions: normal move, zoom/touch, rejected move, stale position, and combat. Click-to-preview handling measured 24–52 ms on headless Chrome/SwiftShader; these are local test measurements, not physical-device guarantees. Repeated taps produced one command. Preview did not mutate authority, rejected/stale moves restored the original position, and combat waited for confirmed ranks/outcome. Evidence: `Logs/move-preview-result.json` and associated pending/corrected screenshots.
- `tests/board-attack-render.cs`: 72 actual Unity renders and elevation assertions cover both factions, normal/zoom, approach/contact/settled frames, higher-rank win, tie, Miner/Bomb, Scout/Bomb, Spy/Marshal, and Flag. Evidence: `Logs/BoardAttack/`, `Logs/board-attack-render.log`.
- `tests/board-attack-browser.mjs`: actual Unity reload during reveal, pause/resume, separate player acknowledgments, and raised-attacker settling passed. `Logs/board-attack-ack-side0.json`, `Logs/board-attack-side0-result.json`.
- `tests/tile-spectator-visual.mjs` against the final build: normal/zoom, perspective switching, rank redaction, read-only sequence, and public combat reveal passed; zero uncaught browser exceptions.

All networking tests used isolated local fixtures. No new Playroom identities or live classroom sessions were created. Solo, rules, transport, and teacher authority were not changed in this release.
