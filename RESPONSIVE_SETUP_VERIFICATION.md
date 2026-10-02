# Responsive setup and message verification

- Unity 6000.5.2f1 WebGL build: ResponsiveSetupFinal succeeded.
- Automated suite: 197 passing tests.
- Actual Unity WebGL client connected to an isolated live Playroom classroom: intro Start, formation swap, Shuffle, and formation confirmation each dispatched exactly once while state responses were deliberately delayed 700 ms.
- Off-turn preset message accepted without changing turn; sender and opponent notification panels rendered and expired. Screenshots inspected locally.
- Classroom status separator and narrow-width wrapping verified at 420 pixels.

Background state reads no longer disable action controls. One pending action can wait behind a read and is revalidated before dispatch; mutations still block duplicate submissions. Formation selection responds during reads. Normal gameplay movement was not changed.

Preset notifications use a passive portrait/name/quoted-text panel, with existing priority overlays taking precedence. Full two-player/teacher visual regression testing remains manual; this focused check rendered one real Unity player and used an isolated teacher authority plus an inert opposing participant. No existing user classroom was changed.

The browser test waits for delivered Unity state before exercising controls; an earlier attempt observed the transport response before Unity received it and was discarded as invalid evidence.