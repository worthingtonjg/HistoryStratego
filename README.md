# Civil War: Hidden Orders

Unity WebGL + Playroom classroom strategy game; no custom backend at runtime.

- [Student entry](https://worthingtonjg.github.io/HistoryStratego/)
- [Teacher entry](https://worthingtonjg.github.io/HistoryStratego/teacher.html)
- [Teacher workflow and accepted trust model](development-docs/BROWSER_RELEASE.md)
- [Focused manual checklist](development-docs/CLASSROOM_MANUAL_CHECKLIST.md)
- [Verification](development-docs/BROWSER_VERIFICATION.md)

Students use four-character Playroom codes; legacy full codes work. The teacher enters the chosen convenience key in Unity, restores the locally retained class, or creates a new one. New class retires the previous session. This is a casual barrier, not strong authentication. Keep the teacher browser visible; hiding it pauses play.

For a source build put your own key in ignored LocalConfig/teacher-key.txt. Never commit it. Pages deploys materialized LFS assets through Actions. Run `node --test tests/*.test.mjs` for regression tests. Local static preview: `python -m http.server 8090 --bind 127.0.0.1 --directory docs`.
