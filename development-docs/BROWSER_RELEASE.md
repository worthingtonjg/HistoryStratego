# Classroom browser release

Student page: `/HistoryStratego/` or `/HistoryStratego/student.html`. Teacher page: `/HistoryStratego/teacher.html`.

The teacher enters the chosen convenience key in Unity's masked field. The current classroom restores automatically on the same personal browser profile, including NPC seats/controllers. If no current classroom exists, choose Create classroom. Give students the four-character code shown above the game. Existing full codes still work. Students see only code + Join; returning student tabs reconnect to their original full classroom identity.

The teacher pairs students, starts/pauses/ends games and watches matches as before. Keep the teacher page visible and device awake. Backgrounding the teacher intentionally pauses the class; a background student can still auto-continue already-rendered combat while the teacher remains active.

**New class** ends the previous session and retires its code/tokens from normal gameplay. Existing encrypted checkpoints are retained, but retired classes cannot resume. The page restarts Playroom; enter the same teacher key again and a fresh room/roster is created automatically. No per-room recovery code is typed. Students see Class ended and can choose Join next class when given a new code.

Recovery material is remembered locally on the teacher's personal machine; the chosen teacher key is not stored by the browser. Clearing browser storage loses local recovery. Reopening requires the same convenience key. A crash may lose the latest periodic checkpoint. No automatic daily deletion occurs.

## Security and room codes

This is an explicitly accepted casual barrier, not strong account authentication or anti-cheat. The compiled verifier can be reverse engineered and browser code can be modified. Playroom host changes never grant normal teacher controls. Student messages/redacted responses remain encrypted; the trusted teacher browser holds complete game state.

Four-character first joins intentionally trust the teacher key advertised in the room. They do not independently authenticate teacher identity; a malicious participant could impersonate a teacher on first join. The full identity is retained for reconnect, preventing an old session from silently switching to a new owner if a short code is reused. Legacy full-code joins retain fingerprint checking.

The pinned Playroom SDK generates four-character candidates and creates rooms through its service; this is not a locally maintained global registry. New teacher creation clears stale invite hashes and refuses an already-advertised owner, an unexpected non-host creation, or a code retired in that browser. Simultaneous classes should use their distinct active Playroom rooms; short codes are not globally/permanently unique. A manually re-entered short code may identify a different future class after service reuse. No custom server or paid service has been added.

## Local configuration/build

Put the user-chosen key in ignored `LocalConfig/teacher-key.txt`, one line, at least eight characters. Do not commit or share it. The Unity build consumes it internally and embeds a salted verifier only. Missing/empty configuration fails closed. Generated verifier assets are removed after building.

Use Unity 6000.5.2f1, WebGL module, and `BuildWeb.Build` (batch mode with graphics enabled because the existing preview helper renders). Set HISTORY_BUILD_OUTPUT to a fresh stage, then `node tools/package-browser.mjs Builds/ClassroomEntryFinal`. Node is development tooling only; the deployed runtime is static Unity + Playroom. Test with `node --test tests/*.test.mjs`.

Playroom internet access is required. The free development plan has a 10 unique users/day limit. Validate the final host and Playroom on the school network; GitHub was previously reported blocked there.
