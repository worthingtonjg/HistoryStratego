# Teacher cards verification

Unity 6000.5.2f1 WebGL build `Builds/TeacherCardsRelease` succeeded (`Logs/teacher-cards-build.log`).

Teacher roster cards display commander.fullName with a wrapped name area and retain a fallback for older records. In-game matchup labels are unchanged. Paired matches retain status, capture counts, Spectate and Remove. Unpaired players appear in labeled Union and Confederate columns with counts. Selection uses a gold outline, SELECTED status and a cancelable button. Existing phase and faction pairing policies are unchanged.

Nine focused dashboard/pairing/removal tests passed (`Logs/teacher-cards-tests.log`). Actual Unity local browser fixture passed cross-faction pairing, preservation of the existing match, spectator entry/return, removal confirmation cancellation, and confirmed removal preserving the other match. Zero browser exceptions. Screenshots inspected at 1600x900 and 1024x768: `Logs/teacher-cards-wide.png`, `teacher-cards-selected.png`, `teacher-cards-paired.png`, `teacher-cards-narrow.png`.

Evidence: `Logs/teacher-cards-actions.json`, `Logs/teacher-cards-unity-result.json`. No live Playroom identities or user classrooms used. Fixture browsers close on completion. Existing header placement, neutral spectator and background-tab fixes remain included.
