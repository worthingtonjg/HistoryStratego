# Responsive input and board-only battle verification

The previous formation exchange waited for the teacher reply. A local 350 ms preview now starts on the valid second click, stays stable across pre-action polling snapshots, and reconciles with the authoritative revision/draft. Rejection, changed context, or connection failure restores the latest confirmed formation. Further swaps stay serialized.

Legal selection targets are supplied by the existing authoritative movement rules and cached once per position/side. The player can show immediate highlights without knowing opponent ranks or duplicating the rules. Every move is still validated by the teacher authority. One valid destination intent can wait behind a state read or selection request; it is revalidated against match, position, side and legal targets before dispatch. Repeated clicks do not create duplicate moves.

Battle rendering and dismissal hit-testing are confined to the board rectangle. The Instructions/Game Log sidebar remains usable and sidebar clicks do not acknowledge combat. Preset messages use the matchup header, above the battle and clear of the logo and spectator perspective control, retaining existing expiry/cooldown behavior.

Verification:
- 218 automated tests passed, including preview reconciliation, target-cache privacy/repetition rules, and battle bounds.
- Unity 6000.5.2f1 WebGL build ResponsiveInputRelease succeeded.
- Actual Unity local fixture with 1,400 ms state delay and 700 ms swap-reply delay: preview triggered in approximately 33-39 ms, before the queued action reached authority; one accepted exchange and a rejected exchange/visual rollback verified.
- Actual Unity local gameplay fixture: immediate selection highlights; repeated destination clicks produced exactly one move; sidebar switching did not acknowledge a ready combat. Battle/sidebar/header screenshots inspected.

Timing is from local click-to-preview instrumentation under injected delay, not a production-network benchmark. The user's exact old session was not replayed. This pass used local fixtures with Playroom presence stubbed and did not create live Playroom participants or run a load test. Existing user classrooms/tabs were untouched. Broader classroom and multi-viewport QA remains manual.