# Upright combat and non-overlapping contact

The main board retains candidate D low tiles and perspective. Only Layer 29 combat stages create the prior upright base/body/front geometry and use the previous frontal battle camera. Existing alpha artwork stays on the front, with faction-colored backing and restored upright art margins. Rank text remains upright.

Cause: the old 1.05-unit approach ended with centers only .65 apart, narrower than the new low tiles and even the old upright bases. The final upright combat bases are .76 wide. Approach now derives from both starting offsets minus base width and a .01 contact gap: centers stop .77 apart. Outward loser-only toppling and timing remain unchanged. Renderer base width and motion share one constant.

Passed on Unity 6000.5.2f1:
- Import/IL2CPP/WebGL build: Builds/UprightCombatRelease; Logs/upright-combat-build.log; exit 0.
- Eight focused compiled/unit tests, including 36,036 trajectory samples across all ranks/outcomes. Rotated visible base/body/face bounds remain separated during approach, contact and toppling. Special immobile ranks do not approach.
- 36 actual Unity impact/mid-topple/final frames: both attacking factions, ordinary win, tie, Miner/Bomb, failed Bomb attack, Spy/Marshal, Flag. Exact-contact and special-outcome pixels inspected under Logs/CombatContact.
- Actual WebGL normal combat in both attack orientations; separate redacted players each explicitly acknowledge only their own view, both acknowledgements required. Teacher pause blocks input; resume permits continuation. A first fixture incorrectly expected paused clicks to acknowledge; corrected test preserves existing pause behavior.
- Actual portrait/landscape zoom combat/message checks, with no accidental acknowledgement or sequence advancement from messaging; zero browser exceptions.
- Actual main-board normal/zoom screenshots confirm the selected low-tile board remains intact; no live Playroom identities or classes touched.

Reproduce: node --test tests/combat-contact.test.mjs tests/cutscene.test.mjs tests/combat-click.test.mjs. Set HISTORY_VISUAL_BUILD=Builds/UprightCombatRelease and run tests/upright-combat-visual.mjs with HISTORY_FOCUS_SIDE=0 and 1; tests/board-focus-combat-visual.mjs. Exact-frame Editor capture source is tests/combat-contact-render.cs (copy temporarily into Assets/Editor, invoke CombatContactRender.Render, then remove the temporary script/meta).

Evidence: Logs/upright-combat-ack-side0.json, upright-combat-ack-side1.json, upright-combat-side*-normal.png, upright-regression-board-side1-*.png, CombatContact/*.png. Publication evidence is saved separately to Logs/upright-combat-deployment.json.
