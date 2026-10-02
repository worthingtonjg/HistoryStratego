# Classroom flow update

Late arrivals can be paired during active or paused rounds by selecting two connected, unpaired students from opposite factions. Existing matches stay unchanged. Authority rejects student requests, occupied seats, stale seats and invalid pairings; repeated pair requests are idempotent. Paused rounds remain paused.

New formation countdowns are five minutes. Early locking remains available; pause/resume retains remaining time, and existing started deadlines are not rewritten.

Explicit classroom retirement replaces the student's Unity waiting view with a focused Class ended screen and Join next class action. The old game is hidden and inert. End round, ordinary waiting, pause and connection errors do not cause this transition. Next class clears the old browser session and student token before returning to code entry.

Verification: 224 unit tests passed. Unity 6000.5.2f1 WebGL build ClassroomFlowRelease succeeded. Actual Unity teacher fixture clicks created exactly one new pair while retaining the first match, with zero browser exceptions. Packaged DOM/browser check verified normal waiting remains visible, retirement hides/inerts Unity, and Class ended receives focus. Screenshots inspected in Logs/late-pairing-after.png and Logs/class-ended-primary.png. All graphical checks used local fixtures; no live Playroom identities or user sessions were used. Broad classroom/phone testing remains manual.
