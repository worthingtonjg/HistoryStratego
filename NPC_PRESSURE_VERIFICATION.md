# NPC advance policy verification

The previous ordinary-move score used Manhattan distance, only 0.4 points per forward row, and an uncapped lifetime penalty for visiting a square. Lakes and friendly blockers could make the apparent route misleading, while repeatedly used attack lanes accumulated penalties and made quiet home moves attractive.

The shared policy now computes a bounded, occupancy-only distance map to empty squares beside enemy pieces. It rewards progress along reachable approaches (4 points per square, capped at four squares), forward rows (1.5), and entering deeper enemy territory (3 per row). Ordinary attack incentives rise from 7–13 to 22–29, with an additional bonus for a publicly known win. Immediate quiet reversals cost 12 and recent repeated directed moves cost 7; lifetime visit penalties are capped at 2 so useful lanes do not become permanently unattractive. Opening friendly routes remains rewarded.

Known losing attacks are still excluded from the preferred candidates. Spy safety/standoff and known-Marshal missions, assigned Miner bomb routes, idle special-piece home boundaries, lakes, blockers, and legal emergency fallbacks retain their existing protections. No enemy rank is read from the board; only public combat/movement knowledge informs known outcomes. This is a scoring adjustment with one bounded breadth-first distance map, not a search/ML overhaul.

## Seeded comparison

Eight identical full-army seeds, 160 alternating moves per game, 1,280 moves per version:

| Metric | Before | After |
| --- | ---: | ---: |
| Attacks | 214 | 267 |
| Crossings into enemy territory | 145 | 169 |
| Moves ending in enemy territory | 297 | 389 |
| Net forward row progress | 818 | 995 |
| Immediate same-piece reversals | 88 | 6 |
| Same-piece directed moves repeated within 24 plies | 55 | 4 |

These are bounded self-play scenarios, not a claim of increased win rate or improvement in every game (one seed made fewer attacks). Every selected move was validated by the rules engine. Opposing board-rank accessors threw on access; neither version read them. Memories were serialized between moves to exercise persistence.

Run locally: `node tests/npc-pressure-comparison.mjs 6805766` (public checkout baseline: `43f810f`). Evidence: `Logs/npc-pressure-comparison.json`.

26 focused tests passed across pressure, mobility, public knowledge, and NPC first-turn safety/pacing. Cases cover both factions, lake detours, fresh/open routes, recent reversals, known losing/winning attacks, hidden-rank guards, special pieces, and equality between the generated browser policy and offline policy.

Both solo and classroom NPCs import the same generated browser policy. Existing Unity assets and timing are unchanged; this JavaScript-only release needs no Unity rebuild. No new live Playroom identities, classes, or browser/network gameplay tests were used.
