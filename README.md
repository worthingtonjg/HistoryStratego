# Civil War: Hidden Orders

A local Unity WebGL prototype for an American Civil War history classroom. Confederate forces (red, first move) face Union forces (blue). The fictional board game does not recreate historical encounters.

**Current browser release:** Unity + Playroom; no custom backend required. The teacher browser runs the classroom. See [browser release instructions](development-docs/BROWSER_RELEASE.md). Older Node code remains reference/development code.

From this directory run `python -m http.server 8090 --bind 127.0.0.1 --directory docs`, then open http://127.0.0.1:8090/index.html in an external browser. Internet access to Playroom and esm.sh is required. No preview server is guaranteed to remain running overnight.

## Battle presentation and teacher observation

Each player reviews the revealed combat and clicks **Continue**. Both acknowledgments are required before play proceeds. A fresh click or five readable foreground seconds acknowledges combat; teacher pause freezes automatic continuation while manual Continue remains available. Reloading preserves unread combat, including the final battle before a win/loss screen. The caption names the result, red/blue role boxes identify the actual sides, and a quoted classroom-friendly line appears below the action. Only semantically suitable lines name the winning speaker; bomb/tie/narrator lines remain unattributed.

Spectator mode is strictly watch-only: **Watch RED**, **Watch BLUE**, and **Back to teacher desk**. Pause, Resume and End are class-wide controls on the teacher desk, not spectator controls. The absent-player recovery API remains teacher-authorized, but no spectator recovery button is exposed. The staged `CutsceneStage` build also uses a slim board surround and closer camera framing while keeping all squares visible.

## Formation defaults and Shuffle

Each player independently generates a fresh 40-piece formation for a new match. Shuffle uses the same algorithm in Unity and the browser/demo client. The Flag is randomly placed in any of the ten back-row squares, including corners. Bombs occupy every available adjacent setup square directly toward the opponent and to the left/right. That uses two Bombs in a corner or three elsewhere; the remaining Bombs are randomized. All eight Scouts occupy random front-row squares. All other pieces fill the remaining squares randomly, preserving classic counts.

Front/back and left/right are relative to the owning player, so the two armies face opposite directions correctly. Manual swaps remain allowed before Lock; these are convenient defaults, not additional game rules. Unity and JavaScript implementations are checked against 256 identical seeded vectors. Fresh demo setups independently shuffle each side before locking; current locked armies are never changed.

## Run locally

Prerequisites already found: Node 24.16.0, Git, Chrome, Unity 6000.5.2f1 with WebGL module. No npm install is needed.

1. Open PowerShell in this repository.
2. Run `npm start`.
3. Open `http://127.0.0.1:8080/unity/index.html`. The terminal prints a fresh class code and private teacher key.
4. In one browser, enter the local teacher key and click Open teacher desk.
5. In two other browser profiles/incognito sessions, enter only the class code. Neutral seat labels appear until teacher pairing assigns a historical commander. Separate tabs also keep independent sessionStorage tokens.
6. Teacher: randomize pairs or select two roster names to swap, then Start.
7. Students: shuffle or swap formation pieces, then Lock formation. The red Confederate side moves first (an abstract rules convention).
8. Teacher: Pause blocks play at the server; Resume restores it; End stops the round. Randomize/re-pair and Start for another round. Odd students and late arrivals wait.

The server binds **loopback only**. It is not deployed and cannot yet be joined from separate classroom computers. Restarting clears in-memory class state and invalidates tokens. Refreshing a browser during a running server restores its seat. Close/reopen without its session token cannot reclaim a seat yet.

## Build the primary Unity client

Unity Hub activation succeeded on this machine. Add this project using Unity **6000.5.2f1**.

From the Editor choose **History Game > Build WebGL**, or run:

```powershell
& 'C:\Program Files\Unity\Hub\Editor\6000.5.2f1\Editor\Unity.exe' -batchmode -quit -projectPath 'C:\code\github\HistoryStratego' -executeMethod BuildWeb.Build -logFile 'C:\code\github\HistoryStratego\Logs\webgl-build.log'
```

The build command creates/saves the main scene, sets the custom template and disables compression for simple local serving. Then run `npm start` and open **http://127.0.0.1:8080/unity/index.html**. The Editor client talks to localhost:8080. WebGL uses its page's origin. The Unity client has teacher and student flows, formation editing, the board, combat dispatches, and the fact banner.

## Tests

For the current staged cutscene/board build, run `npm test`, `node tests/cutscene-browser-smoke.mjs`, and `node tests/board-framing-browser.mjs`. The latter two use `Builds/CutsceneStage`, isolated fixture servers and blocked SDK loading. Older graphical scripts below target earlier saved build stages and record earlier UI flows.

```powershell
npm test
node tests/browser-smoke.mjs
# Optional live service check (uses free-plan quota):
node tests/browser-smoke.mjs --live
node tests/unity-browser-smoke.mjs
node tests/unity-layout.mjs
# Optional live Unity proof (two student connections):
node tests/unity-browser-smoke.mjs --live
powershell -ExecutionPolicy Bypass -File tests/compile-unity.ps1
```

The browser test starts its own ephemeral server and headless Chrome profile; it never drives your normal browser. It uses three isolated contexts. By default it deliberately blocks the SDK to verify connection-failure fallback without using the free plan. Add --live for three real connections (teacher and two students), which may count toward free-plan quotas. Do not repeatedly run live tests needlessly.

The C# script compiles against installed Unity assemblies. This is source/API validation only, **not** an Editor import, IL2CPP/WebGL build, or Unity runtime test.

See [verification](docs/VERIFICATION.md) and [architecture](docs/ARCHITECTURE.md). Test screenshots and machine-readable results are in `docs/evidence/`.

## Playroom

Public development Game ID: `zN6Oyc9pDGlt60CITwGe`. It is not a secret. JavaScript core is pinned to **playroomkit 0.0.97**, loaded through an exact-version ESM URL. Unity uses a small WebGL JavaScript bridge to the same presence adapter.

Teacher and student login automatically connect to the same server-selected classroom room; there is no separate Playroom form or room code to copy. The room remains stable across rounds and reloads. Stale invite hashes are cleared so the documented roomCode option selects the authoritative room. Reloading restores student credentials from sessionStorage; teachers re-enter their private key after reload. Connection failures show a clear fallback and do not prevent teacher-authorized local play. Use Reload and reconnect (or refresh Unity) to reconnect without creating another student. An ended round stays ended, including if a pending Playroom connection finishes later.

No ranks, teacher keys, student bearer tokens, or authoritative game state are placed in Playroom shared state. No paid persistence or asynchronous turn-based API is used. Live integration needs internet and permission to reach the Playroom/ESM service domains.

## Content and rules

`web/facts.json` contains 27 editable facts supplied with National Park Service / National Archives source links. The banner rotates every 20 seconds and has Pause, Next, and Source controls. It never claims “on this day.”

The rule profile is the full retail 40-piece game: 10×10, four setup rows, standard lakes, all specialist rules, side 0 first, flag/no-legal-move victory, and the retail prohibition on a third consecutive traversal of the same two squares. Modern numeric labels use 10 as strongest and 1 as Spy. This is not the shortened 30-piece product or tournament chasing adjudication. See [rules](docs/RULES.md).

## Remaining setup

- Unity build/runtime checks passed; validate on the actual classroom browsers and hardware.
- Connect school-approved hosting and real teacher/student authentication before classroom deployment.
- Add session persistence, seat recovery, attendance moderation and rate limits before internet exposure.
- Validate the eventual hosting domain, Playroom, CDN and source links on the actual school network. GitHub is reportedly blocked there; do not assume GitHub Pages.
- Keep development on the chosen free Playroom plan. No purchase, deployment, push, new service account or paid upgrade was performed.

## Teacher spectator

After starting a round, choose Spectate beside a match in the Unity teacher desk. The view is read-only and automatically follows the player whose turn it is: that army has visible ranks, the opponent stays hidden, and normal combat dispatches remain available. Board orientation stays fixed with Confederate forces at the bottom. Back to matches selects another game. There is no omniscient reveal toggle. Pause/Resume/End remain teacher controls.

## 3D tabletop preview

Current separate preview: http://127.0.0.1:8080/tabletop/index.html. Navigate the existing teacher tab there to retain login; select the match's Spectate button. Perspective follows the active player automatically; opponent ranks remain hidden. The watched demo is stopped until the user is ready. Existing server/class/key are retained.

To reproduce this staged build: set `$env:HISTORY_BUILD_OUTPUT='Builds/TabletopStage'`, then run the Unity build command above with graphics enabled. `node tests/tabletop-browser-smoke.mjs` runs the actual 3D canvas regression; add `--live` for a quota-consuming Playroom check. `node tests/tabletop-performance.mjs` compares the original Builds/WebGL baseline with Builds/TabletopStage. Copy the staged directory to web/tabletop for the alternate preview route. Build output is intentionally not committed.

## Current spectator preview

Open **http://127.0.0.1:8080/tabletop/index.html** in an external browser. Enter the existing local teacher key and Open teacher desk. Demo Red and Demo Blue are prepared in the waiting roster. Wait for watching confirmation before starting the demo; then Start and select Spectate beside their match. The assistant controllers remain readiness-gated and will not lock formations or move unattended.

Selection is gold; legal empty destinations are green, legal attacks orange. Battle uses a separate stage; both ranks remain readable until both participants acknowledge. Teacher spectator needs no acknowledgment. Teacher Pause/End remain available; Release absent RED/BLUE player explicitly releases only the barrier and keeps that student's unread reveal for reconnect.

Reproduce: set HISTORY_BUILD_OUTPUT to Builds/InteractionStage, run the existing Unity build command with graphics enabled, then node tools/start-interaction-preview.mjs. Current checks: npm test; node tests/interaction-browser-smoke.mjs; optional --live; node tests/interaction-performance.mjs. Server restart resets in-memory state.


Stable user-facing URL: http://127.0.0.1:8080/tabletop/index.html. This page now embeds the current interaction client served internally on 8081; the address stays unchanged. Old /unity/index.html forwards here and preserves its query/fragment. Both server processes must remain running. The original stopped classroom remains on the legacy entry page; new interaction classroom uses the same development key and class code with prepared waiting seats.


Current spectator controls are **Watch RED - nickname** and **Watch BLUE - nickname**. The selected army stays fixed across turns and refresh/re-login; only an explicit choice changes it. The current turn is labeled separately. Both names/colors also appear in combat reveals. The ticker has 27 sourced Civil War entries, including 12 general/battle strategy lessons. Routine polling no longer replaces the connection message. Current graphical checks: tests/presentation-browser-smoke.mjs, tests/presentation-status.mjs and tests/presentation-visual.mjs.

## Staged click and selection update (2026-10-01)

`Builds/ClickStage` is verified and ready for coordinated client-asset promotion; it has not been applied to the live game. No authority restart or new match is required.

Players manually acknowledge combat by clicking anywhere in the game viewport after the presentation minimum. The gesture is consumed, spectators never acknowledge, and both players must still acknowledge before play or the final result proceeds. Paused and teacher-ended unread reveals remain manually dismissible. There is no automatic acknowledgment.

At an actionable own turn, the client selects (never moves) a legal own piece through the authority: the surviving last-moved piece when possible, then a deterministic legal alternative. Manual input takes precedence, including during a delayed selection request; reload and polling preserve the choice. Dispatches opens once when both formations are ready. Facts rotate automatically with a descriptive source link; the old fact buttons are removed. Connection status appears below the matchup names. Results use the winning faction's exact headline and color, actual winner and objective, and stable game-only flavor; teacher-ended rounds remain neutral.

Verification: 85/85 automated tests, successful Unity WebGL build, and three isolated actual Unity browser suites. See `docs/VERIFICATION.md` for evidence and the narrow pre-existing spectator status limitation.


## Commander aliases

New students do not enter names. The server assigns a neutral `Student 01`-style seat label. Teacher Randomize, Swap or Start assigns unique historical leaders to complete pairs: red Confederate and blue Union. Waiting students see their commander profile after pairing. Odd students and late arrivals remain unassigned until a teacher includes them in a pair. The profile is also available during play.

`server/commanders.json` retains 48 sourced profiles (24 per side), enough for the 40-seat limit. Short display aliases are distinct, with full names, roles, historical examples and references in the profile. Assignment is independent of piece ranks or army setup. Profiles describe history; fictional board outcomes do not recreate those encounters. No real-student roster is collected.

Reconnect preserves the current assignment. Pre-start swaps preserve an existing same-side commander when possible; crossing sides assigns a commander from the new faction. Match creation freezes both aliases and profiles, so later pairing changes cannot rename old battles or results. Pool exhaustion fails without partially changing pairings. A lost browser token does not recover a seat automatically.

The alias backend and Unity build are now active at the unchanged canonical URL **http://127.0.0.1:8080/tabletop/index.html**. The outer page remains on 8080 and embeds the updated authority/client on 8081. The authorized transition created a fresh classroom while retaining the existing local teacher key; previous matches and player tokens were not restored. No token/state backup was created.

Do not restart these processes merely to refresh a browser. A deliberate future classroom restart can use `node tools/start-alias-preview.mjs` after stopping only the existing 8081 preview authority. It reads the already-existing local teacher-key mechanism, generates a new class code, and serves `Builds/AliasesStage`. Its log prints the new class code without printing the key. Keep the 8080 canonical wrapper server running. Students refresh the same URL and join the fresh class; an expired-seat message after restart is resolved by joining with the new class code.

The assistant participant controller accepts `node tools/interaction-seat.mjs <controller-id> <class-code>`. It creates exactly one anonymous participant in an isolated actual Unity browser and stays idle until explicitly enabled. It uses only that participant's redacted state. Its Playroom presence was verified connected after the transition; no human seat was created by verification.


## Immediate commander assignment (staged, not applied)

The next staged update assigns a historical leader and profile immediately on join. The leader fixes the student's faction and never changes during teacher Randomize, repeated rounds, or reconnect. Join does not pair anyone or start a round. Randomize builds Union-versus-Confederate pairs; same-faction swaps change opponents. Cross-faction swaps are rejected with an explanation instead of renaming a student.

New arrivals balance the recently connected roster. Student activity is measured by authenticated API requests with a 90-second grace period, independently of Playroom host status. Inactive seats retain their commander and token; a later Randomize/Start excludes unavailable seats and pairs only available opposite factions. An ongoing match is never canceled by this timer. Reconnecting restores the same identity; if no current pair includes that seat, it waits for the next teacher action. Losing the browser token still requires a new seat. Existing reserved seats count toward the 40-seat capacity; commander pools are never recycled or substituted across factions.

Profiles use a tighter measured layout, one flowing historical description, a clear explanation of the game's fictional rules, and a recognizable Learn more source link. All original researched profile/example text and source references remain in `server/commanders.json`; `description` is their combined display prose. Portrait review is separate and does not block this update.

The current live class remains unchanged until a coordinated transition. Its current assignments and tokens cannot be moved to a replacement authority by a browser refresh. No live migration or state/token backup is provided; a future restart must explicitly account for the fresh classroom and identities.


## Staged matchup and timed setup release

`Builds/IntroductionStage` requires the matching authority from this checkout. Do not overwrite the running 6936 client or restart its authority without the coordinated transition: that session intentionally retains the preceding manual setup behavior. No new NPC tactics are part of this release.

After teacher Start, each student sees both immutable commander profiles. Their own first Start Game starts their own server-controlled 60-second setup period. Swaps and Shuffle save to the server immediately; only confirmed arrangements are displayed. The second Start Game locks the formation early. At expiry the server locks the latest confirmed valid formation, including while disconnected. Both players must lock before play begins. A player still reading the intro has no running timer. Teacher Pause freezes remaining setup time, Resume preserves it, and End cancels it. Reload retains the saved draft and deadline. The countdown is a local estimate from the latest server response; network delay can make the displayed second differ briefly, but only server receipt time decides whether an edit is accepted.

Commander names are underlined profile links with a browser pointer cursor for students and spectators. The bottom setup panel replaces facts until play; the sidebar is labelled Game Log. A nonblocking reminder appears once after 15 visible actionable seconds on the student's own turn. Combat still accepts an explicit click after the animation; it also acknowledges only that viewer after five foreground, readable result seconds. Pause/background/loading time is excluded, teacher authority rejects automatic acknowledgments racing Pause/End, and spectators never acknowledge. Reconnecting restarts the five-second reading interval safely; it never skips an unread result. Both participants' acknowledgments are still required. No timer performs a move or forfeits a turn.

Run `npm test` for rules, authority and compiled timing tests. Run `node tests/intro-browser.mjs` for an isolated actual Unity fixture using IntroductionStage; it never targets the live class. Older untimed rule/presentation fixtures explicitly opt out of the new setup clock. The older browser verification harness is not the timed-setup client; use Unity for this flow.

The own-seat controller supports `begin` after `user-ready` to acknowledge only its own intro, then `lock` to lock its saved draft. The existing driver's tactics are unchanged; the live driver is not reloaded by source edits.

Current local preview: class 2B65 at `http://127.0.0.1:8080/tabletop/index.html`. The authorized IntroductionStage transition is complete. ContinueFixStage client assets now repair slow-frame auto-continue and add exact `Six Seven!!!!` flavor for 6/7 combat. Refresh the existing game tab to retain your token and match. Focus-paused auto-continue is labeled explicitly; click inside the game to resume focus, or use manual Continue. No server restart is needed for this update.


## Staged tutorial and NPC update

`Builds/TutorialStage` includes the verified three-second reminder panel plus exactly three always-on contextual tips: first enemy Bomb discovery, first enemy Marshal reveal, and first loss of your own Miner. Tips use only your combat events, wait for battle/turn overlays, remain for eight seconds (twelve for the longer Marshal explanation), pause when inactive, and resume across refresh. Completed tips stay seen for that player and match. The versus screen now states “Capture the Flag to win.” These client changes are staged, not applied to class 2B65.

The staged NPC remembers legitimately revealed ranks through public moves, avoids known losing attacks, keeps one safe Miner/bomb mission, and cautiously positions its Spy against a known Marshal. Idle Spies and unassigned Miners stay in their own half; canceled missions route safely home. An emergency crossing is permitted only when no other authoritative legal move exists, as explicitly approved. Primary, fallback, and emergency pools are checked in that order. No rank-based general chase/flee behavior was added. The running NPC keeps its old loaded policy until a coordinated driver replacement; changing files alone does not replace that process.

The staged tutorial/reminder and NPC update above has now been applied on explicit approval for a fresh round in the same class 2B65. The same Burnside and Pickett identities remain; refresh the existing game tab. Each player dismisses their own versus screen to begin setup. The teacher key and canonical URL are unchanged.

## Verified visual and deadline stages

The corrected-alpha `AlphaVisualRelease` client is now served by the existing tabletop preview without restarting the authority or current match. Marshal and Miner art, clickable header portraits and gentle lake animation passed actual Unity browser checks.

`DeadlineReviewStage` separately passed the WebGL build, all 146 tests and actual Unity deadline-flow checks. Its new server timers require coordinated backend adoption; they are not enabled by the visual-only refresh. Restarting the current in-memory authority loses current seats and match state. See [timer contract](docs/TURN-DEADLINE.md) and the latest [verification evidence](docs/VERIFICATION.md).

## Staged piece details and rank badges

`Builds/PieceDetailsStage` adds white numeric ranks in dark corner badges, slightly wider piece faces, and a selection footer with art, role rules and flavor text. The footer uses the current authorized server selection; setup retains its controls and hidden opponents never gain details. Successful moves/deselection restore historical facts. Normal surviving pieces speak combat quotes under the winning commander name; ties and all Bomb encounters remain unattributed. The exact Six Seven!!!! line is retained.

This client was checked with deadline fields removed, so it can be adopted without replacing the live authority. New deadlines remain disabled on the old running backend. PieceDetailsStage is now live on the existing tabletop URL; refreshing adopts only the client. The authority and current match were preserved.
