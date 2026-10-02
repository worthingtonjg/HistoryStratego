# Low-tile perspective release verification

Approved candidate D is implemented in the actual Unity WebGL client. Tiles are .84 x .22 x .84 with top-facing art/ranks, faction-colored alpha backing, opaque enemy backs, and darker sidewalls. The board camera uses 45-degree downward perspective with a 30-degree vertical FOV. Framing fits all board corners per render aspect and centers the projected bounds, rather than reusing a fixed preview projection offset. Normal and zoom renders remain cached; camera fitting runs only on size changes.

Grid lines are an explicit single-mesh overlay above the terrain. Horizontal strips are slightly wider in world space to compensate for foreshortening; this avoids relying on barely visible gaps. Terrain textures are generated at 64px per square; no runtime real-time shadows were introduced. Combat uses a higher camera angle to show the tile tops.

## Passed
- Unity 6000.5.2f1 import/IL2CPP/WebGL build, `Builds/LowTileFinal`, log `Logs/low-tile-final.log`, exit 0.
- 20 focused tests: phased formation, confirmed/optimistic swaps, neutral spectator redaction, teacher authorization, spectator switching, combat input.
- Actual Unity graphical checks in both player orientations: 1920x900, 1366x768, 390x844, 844x390, normal and Toggle Zoom. All source art visible; both grid directions inspected.
- Per orientation: 12 corner selections via CDP touch events and three legal moves across desktop normal / phone portrait zoom / phone landscape zoom. Hidden enemy ranks checked in own redacted response.
- Both orientations: all three setup phases, earlier-piece swaps, slow-poll preview, reload recovery, shared deadline, paused-swap rejection and Ready/NPC opponent transition.
- Actual teacher neutral -> Union -> Confederate -> neutral cycle, read-only sequence, normal/zoom, public combat without revealing other ranks or acknowledging combat.
- Actual mobile combat/message controls, no accidental combat acknowledgement or state advancement from sending a message.
- Zero browser exceptions in final visual runs. No live Playroom identities or active classrooms touched.

## Bugs caught and resolved
Dynamic batching transformed the local normals used by the face-only artwork shader; repeated ranks lost artwork. Disabling batching specifically on that shader fixes the issue, verified in actual WebGL. An old spectator test clicked the prior teacher-card layout; the new test targets the current Spectate button. The first synthetic touch run needed a post-touch observation interval; final runs pass both orientations.

## Performance and limits
Sequential 10-second isolated headless Chrome/SwiftShader samples at 1366x900: existing upright build 79.60 browser CPU seconds; low-tile build 62.41. No console errors in either sample. Software rendering uses multiple CPU cores; this is a relative smoke check, not real-device GPU/mobile battery or FPS certification. Physical phones and school-network connectivity were not tested. Phone portraits remain small at full-board scale; zoom and larger screens improve readability.

## Reproduce
Set HISTORY_VISUAL_BUILD=Builds/LowTileFinal. Run tests/tile-gameplay-visual.mjs and tests/tile-formation-visual.mjs with HISTORY_FOCUS_SIDE=0 then 1; tests/tile-spectator-visual.mjs; tests/board-focus-combat-visual.mjs; tests/tile-performance.mjs. These use isolated fixtures and no live Playroom sessions.

Local evidence: Logs/tile-gameplay-side0.json, tile-gameplay-side1.json, tile-play-side*-*.png, tile-phase*.png, tile-neutral*.png, focus-combat*.png, low-tile-performance.json. Deployment confirmation is recorded separately after publication in Logs/low-tile-deployment.json.
