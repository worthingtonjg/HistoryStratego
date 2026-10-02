# Entry/lifecycle release verification — 2026-10-02

168 automated regression tests passed: encryption/redaction, teacher convenience gate, retained recovery, NPC seat reuse, retirement/old-code-token-recovery rejection, new-class admission, short joins, full-identity reconnect and stale-invite/occupied-room guards. The actual C# key verifier was compiled and tested with noncredential fixtures.

Unity 6000.5.2f1 imported/compiled and built WebGL successfully into Builds/ClassroomEntryFinal. The first attempt crashed in the existing preview renderer under -nographics; the targeted retry using graphics-enabled batch mode succeeded. The generated verifier asset was removed after the successful build. The plaintext chosen key was not displayed.

One minimal isolated browser smoke visually verified the actual Unity teacher key screen before any room connection, and the separate code-only student page. It did not enter the user's key or start a class. Evidence remains private in Logs/entry-render-1790949583853, outside the public repository.

Manual valid-key/create/join/New class/reopen and simultaneous-teacher checks for this release are deliberately left for the user to perform; see CLASSROOM_MANUAL_CHECKLIST.md. Earlier release gameplay/Playroom combat/recovery tests are historical evidence, not a claim that this new graphical lifecycle walkthrough passed. School-network access remains unverified.
