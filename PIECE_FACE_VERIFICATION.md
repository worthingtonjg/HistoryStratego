# Piece-face artwork verification

Unity 6000.5.2f1 build `Builds/PieceFaceRelease` succeeded (`Logs/piece-face-build.log`). This is an artwork-only correction; camera, lights, body/base geometry and rank transforms are unchanged.

Diagnosis: the illustrated face is a 0.014-unit-deep cube, using the same artwork material on its front, top and sides. Reusing the texture on the very thin top edge produced a compressed duplicate strip, visible in the controlled before render. The shader already rejects UV values outside 0..1, so ordinary out-of-bounds texture tiling was not the main cause. Texture wrapping is now explicitly Clamp and only the negative-Z front surface samples artwork; other surfaces stay paper-colored.

Flag/Bomb artwork bottom margin changed from 0.015 to 0.14 of face height (a 0.08625-unit rise, or 12.5% of the 0.69-unit face height). Artwork retains its 72% height and 78% width. Other portraits keep their prior placement, and rank transforms are untouched. The face itself remains above the base: face bottom 0.175, base top 0.17, in piece-local coordinates.

Validation: captured the same arrangement with the previous build and corrected build. Actual Unity normal and zoom views were inspected for both sides. Bomb/Flag images have visible margins; duplicate colored edge strips disappear; ordinary portraits/ranks stay in place. All three isolated visual runs completed with zero browser exceptions. Evidence: `Logs/piece-before-side0-*.png`, `Logs/piece-after-side0-*.png`, `Logs/piece-after-side1-*.png` and corresponding `*-result.json` files. No live Playroom identities were used.

Attachment limitation: the supplied Library PNG could not be installed by the current supported helper on Windows because os.setxattr is unavailable. One bounded retry failed identically; no metadata bypass was used. Diagnosis and verification use controlled screenshots from the actual local Unity builds instead.

Read-only camera/lighting findings: board camera orthographic at (0,14,-13), aimed at (0,0.15,0), about 46.8 degrees downward. Standard view ortho size 4 with 1400x899 render; zoom uses a square 1000x1000 render and size 5.6, with the same angle. Battle view uses (0,1.9,-5), target (0,0.55,0), size 1.35. Configured ambient is flat RGB(0.42,0.42,0.42); directional light intensity 0.85, rotation (48,-30,0), shadows disabled. Actual PieceFace and terrain materials are unlit; body shader uses a hard-coded normal-dot light formula rather than scene lights. No camera or lighting experiment/change was performed.
