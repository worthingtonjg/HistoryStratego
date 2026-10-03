# Standalone solo verification

Student entry now offers **Play against computer** below the class-code form. It opens the existing Unity VS introduction with two assigned generals, then the three guided formation stages. No teacher, classroom waiting room, Playroom SDK, or network authority is required.

Progress is saved in this browser tab. Reload resumes the same match; hidden tabs pause its local clock. **New solo game** replaces that save after confirmation. **Classroom entry** restores the prior classroom identity. Victory includes **Play again**.

## Verified

- Unity 6000.5.2f1 WebGL build: `Builds/SoloRelease`, successful exit 0 (`Logs/solo-build.log`).
- 40 targeted Node tests passed across solo, formation, browser transport, student sessions, classroom exit, and teacher entry.
- `node tests/solo-browser.mjs`: actual packaged Unity introduction, all three setup stages, reload at stage two, normal and zoom rendering, a human move and NPC reply while offline after loading, scripted flag combat and victory, Unity replay button, and classroom identity restoration. Playroom endpoints were blocked throughout; no transport module or external fetch loaded. Zero uncaught browser exceptions.
- Screenshots: `Logs/solo-vs.png`, `solo-play.png`, `solo-zoom.png`, `solo-flag-combat.png`, `solo-win.png`. Machine result: `Logs/solo-browser-result.json`.

The first launch still needs access to the static game assets. This is not an installed offline application. The victory check uses a deliberately small test position, not a complete forty-piece game. No new live Playroom identities were used.

The human UI receives only its redacted player view. The NPC uses its own view and remembered revealed information. As with other local single-player games, the browser owns the full simulation and save; developer tools are not an anti-cheat boundary. This does not alter classroom teacher authority or multiplayer permissions.
