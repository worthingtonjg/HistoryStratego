# Teacher capture counts

Teacher pair cards show each player's number of enemy pieces removed, matched by player ID to the authoritative side. The pair-card View log button is removed; the in-game Game Log remains.

The authority increments persistent counters when combat resolves. Attacker wins credit the attacker; defender wins (including bombs) credit the defender; ties credit one to each side; capturing the flag counts as one. Ordinary moves and duplicate request retries do not increment counts. Totals survive journal truncation and checkpoint recovery. Only integer totals are included in teacher summaries, with no ranks or formation data.

For older checkpoints without counters, completed setup guarantees exactly 40 starting pieces per side and combat is the only removal operation; totals are recovered from missing enemy pieces. Partial setup returns zero. New matches maintain counters directly.

Verification: 214 automated tests passed; Unity 6000.5.2f1 WebGL build CaptureCountsFinal succeeded. Focused one-browser Unity teacher-card fixture used only isolated test data and a fixture teacher identity; this is a visual summary check, not a new authentication test. No live user classroom was changed and no load test was run.