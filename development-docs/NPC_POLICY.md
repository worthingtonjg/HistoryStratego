# Demo policy (staged for the next session)

`tools/demo-policy.mjs` exports `planDemoMoves(state, previousMemory)` and returns `{memory, candidates, status}`. `state` is one participant's normal authenticated response containing `match`, or that redacted match itself. Each candidate has `from`, `to`, `score`, and `reason`. This is a small deterministic heuristic, not a strong Stratego AI.

The driver must keep separate memory per seat and match, pass only that seat's own redacted response, save the returned JSON memory, and never merge memories or consult teacher/other-player board data. Memory contains only observations already available to this participant: revealed bomb squares, local miner tracking IDs, visits, and one assignment. Do not include bearer tokens. A genuinely new match ID or side resets all memory. Repeated polling and JSON serialization/reconnect preserve discoveries, tracking, and the assignment without double-counting moves.

Candidates are geometrically valid suggestions, NOT authority. The driver must call the existing select API and intersect candidates with returned authoritative destinations before moving. This preserves all current movement rules; repeated back-and-forth movement is legal, though the NPC prefers productive progress. If a preferred step is rejected, try the remaining candidates/from-squares in order. An empty candidate list is a policy stall, not a rules-based loss: report it for supervision; do not declare a winner, acknowledge without watching, or invent a move. Existing sequencing, pacing, acknowledgment barriers, and teacher controls remain the driver's responsibility.

## Observation and assignment

A bomb enters memory only after this player's combat journal records its attacking piece encountering an opposing bomb. No guesses from formation patterns, no enemy rank inspection, and no sharing with the opposing bot. The known bomb stays actionable across turns, reconnects, miner deaths, and replanning until its removal is observed by combat outcome or visible empty/friendly occupancy. Removed bombs remain discovery history but are not targeted. Server events are ordered and retained; locally tracked miner IDs follow own movement/combat events and reconcile against visible own miners. If a controller first attaches midgame, it assigns IDs to currently visible own miners instead of inventing previous identities.

There is at most one active `(minerId, bombSquare)` assignment. Initial selection minimizes reachable BFS path length across discovered bombs and surviving miners, with deterministic ties. An existing reachable assignment stays stable even when another miner becomes closer. All other known bombs remain queued. Friendly pieces, lakes, and unknown enemies block paths. A blocked/unsafe/dead-miner assignment is released and the next reachable pair considered. No simultaneous secondary miner assignment is created.

## Miner safety

Miners avoid unknown enemy squares. Ordinary miners also avoid enemy adjacency. Assigned miners first seek a fully safe route to a genuinely observed bomb; if none exists, they may take a purposeful route past unknown adjacent defenders. They still avoid adjacency to known equal-or-stronger mobile defenders and never deliberately attack a known losing non-bomb target. Only the assigned route step receives this exception. Lakes, friendly pieces, and occupied unknown squares remain obstacles. A completely blocked mission stays pending. Safety is reevaluated on each observed state; no hidden-rank inference is used. Scout long-range attack prediction is not implemented.

Non-miners never attack a known bomb. An unassigned miner cannot attack any known bomb; it may make safe ordinary moves without a bomb pursuit bonus. If no safe miner route exists, ordinary legal candidates remain available. The policy does not deliberately rearrange friendly formations as a planner, though ordinary fallback moves can clear blockers. It does not guarantee a win or termination against every position and never fabricates stalemate.

## Validation

Run `node --test tests/demo-policy.test.mjs`. Pure fixtures cover discovery/privacy, repeated polling, durable miner identity, reconnect/new-match reset, shortest path versus Manhattan distance, stable single assignment, death/reassignment, observed removal, blockers/lakes, no-miner fallback, safety detours/retreat/trapping, bomb exceptions, and 100 deterministic seeded safety positions. No live classroom or demo process is used by these tests.

Application is explicitly for a coordinated next session. Importing/testing this module does not alter the running legacy demo.


## Driver integration and next-session gate

The watched driver enables this policy only with `DEMO_POLICY=bomb-aware`. Without that explicit environment setting it retains the legacy policy, so the already-running demonstration is unchanged. Use a separate `DEMO_MEMORY` file for the coordinated new session and keep `DEMO_SEATS` in actual RED/BLUE order. Policy observations/assignment are saved separately for each acting seat before a move, then reconciled from public events on the next turn; no tokens or opponent army are written to memory. The driver still intersects ordered candidates with the server's selected legal targets, preserves pacing/reveal acknowledgments, and reports an empty safe candidate set as a supervised policy stall rather than inventing a result.

`--until-stop` removes the default bounded batch limit while the supervising agent remains active. Teacher Pause/End, explicit stop control, and a rules-based match ending still stop it. This flag does not authorize unattended play.

Integration tests exercise redacted observation -> memory serialization -> authoritative selection -> legal approach -> bomb disarm, and verify that a safety-only policy stall cannot become a fabricated rules-based defeat.


## Current attack constraints

NPC Miners only attack genuinely known ranks 1, 2, and Bomb. This is a hard filter in preferred, fallback, emergency, and NPC timeout decisions, including the last surviving Miner. No Flag exception is currently enabled. Human movement/combat legality is unchanged. If only policy-forbidden attacks remain, the NPC waits; it does not invent defeat or break its attack policy. The teacher can end such a round.

Marshals pursue reachable known ranks 2-9 and avoid attacking known Spies and Bombs. A known enemy Marshal is targeted only after this NPC observed the enemy Spy die in public combat. Its own Spy's death does not count. This memory survives reconnect and resets for a new match. Unknown-target risk remains unchanged, and Flag capture retains its existing priority.

## Initial formation

Full shuffle places all five Miners randomly in available back-row cells after the Flag, its adjacent Bombs, and front-row Scouts. Phase-three fill prioritizes remaining Miners in available back-row cells, preserving every already occupied cell. If insufficient spaces remain, excess Miners use other empty cells. Explicit remaining-piece shuffle preserves Flag/Bombs and reapplies Scout/ Miner row preferences. Timeout fill uses the same preserve-existing-choices policy.


## NPC duel pacing and earned Miner hunt

When both seats are NPCs, each controller waits at least one second after observing its own actionable turn before deciding. The existing 300 ms thinking time and polling cadence remain, so real intervals can exceed one second. Human-versus-NPC play does not gain this delay. Combat must clear both existing acknowledgments before the next gap starts. Ticks are serialized, decisions preserve their original sequence and match ID, and acknowledgments retain the reviewed battle ID.

Exception to the Miner attack whitelist: a specific surviving Miner that actually defeats a Bomb in either of the enemy's last two rows gains permission to attack any opposing piece on the enemy back row, including unknown pieces, stronger pieces and a Flag. The trigger comes solely from observed combat, and the permission follows that Miner's public movement. Death removes it; another Miner occupying the same square does not inherit it. Other Miners and targets outside the enemy back row retain the normal attack restrictions. Reconnect preserves/reconstructs this history without consulting hidden ranks.
