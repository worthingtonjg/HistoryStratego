# Place Flag preselection verification

On first entry into human Place Flag, the existing flag is selected and the other 39 legal home squares are highlighted. The first destination click moves it. Selection is local UI state only; Next and Ready remain explicit actions. Polling does not reselect after a move or deliberate deselection. Reloading during Place Flag selects the flag at its saved current location once; later phases do not auto-select it.

Unity 6000.5.2f1 WebGL build `Builds/FlagEntryRelease` succeeded (exit 0). Nine focused tests passed: compiled C# entry selection and the existing phased-formation rules, timeout, recovery, and NPC setup checks.

Actual Unity browser checks passed for both faction views in local classroom fixtures: normal first-destination movement, no reselection after polls, deliberate deselection, reload of current position, zoom with touch input, manual Next, and editing the earlier flag during Place Bombs. Initial placement remained on the random back row; no automatic Next/Ready occurred. Evidence: `Logs/flag-entry-side0-result.json`, `Logs/flag-entry-side1-result.json` and normal/zoom screenshots.

The packaged solo client also passed VS intro → Place Flag → first destination move, with no poll reselection or automatic progression and Playroom blocked. Evidence: `Logs/flag-entry-solo-result.json`, `Logs/flag-entry-solo-selected.png`.

No live identities or user classroom sessions were used. The separate intermittent gameplay move report remains under investigation; this release does not claim to resolve it.
