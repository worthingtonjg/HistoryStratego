# Header placement and background-tab verification

Unity 6000.5.2f1 successfully built `Builds/ZoomHeaderRelease` (log: `Logs/zoom-header-build.log`).

Toggle Zoom occupies virtual rectangle (980,70,190,42), beside the existing logo/matchup. The extra 68-pixel inset is removed. The original uniform 1200x900 layout is restored; top notices reserve the button's area. Touch targeting uses the same virtual coordinates.

Actual Unity fixture checks passed: player and spectator internal zoom, neutral perspective cycle and public combat, portrait/landscape touch swaps, paused swap rejection, and top notices alongside friendly messages. Inspected screenshots include `Logs/neutral-normal.png`, `zoom-header-player-narrow.png`, `neutral-internal-toggle.png`, `top-tip-friendly.png` and `top-reminder-friendly.png`. No browser exceptions.

Root cause of background pausing: transport explicitly paused on document.hidden and on timer delays above 2500ms. Visibility now checkpoints without pausing; live timer ticks and incoming requests advance the authority clock. Manual Pause and disconnect handling remain authoritative.

28 focused tests passed (`Logs/zoom-background-tests.log`). Actual Chrome background-tab fixture verified document.hidden=true, active classroom and decreasing setup timer, a delayed/frozen host resuming without an automatic pause, and manual Pause persisting when switching tabs (`Logs/background-tab-result.json`). No live Playroom identities were created. Task-owned fixture browsers close on completion.

This verifies tab switching, not continued execution while the computer sleeps, the browser is closed or the OS suspends it. Physical-phone testing remains manual. No hosting, credentials or authority/privacy architecture changes.
