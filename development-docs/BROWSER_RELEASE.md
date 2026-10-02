# Browser release

Unity 6000.5.2f1 WebGL + Playroom SDK 0.0.97. Deployed runtime requires static HTTPS hosting, not Node or a custom backend. Node is a development/test tool. Loopback HTTP works locally.

## Classroom workflow

1. Teacher chooses **Create classroom (teacher)**. Keep this tab visible and the device awake.
2. Copy the full classroom code. Students paste it on the same page and choose **Join classroom**.
3. At the teacher desk randomize pairs or edit them manually, then Start. Late arrivals wait; an odd student sits out.
4. Students prepare and lock their own armies. The teacher can pause, resume, end and watch matches.
5. **Add computer** adds a lightweight opponent using its own redacted player view. Respect the free development participant allowance.

Hiding/disconnecting/suspending the teacher pauses play. For a local demonstration put the teacher in a separate visible window. Becoming Playroom transport host does not grant teacher controls.

## Recovery and trust

Save the private code in the collapsed teacher recovery section privately. Recovery requires that code AND the original browser profile's encrypted local checkpoint. Reload offers Reconnect previous session; recovered classrooms start paused. This is not cloud backup. Checkpoints are periodic and best effort; a crash can lose recent actions and deleting the profile loses recovery. Computer controller loops do not automatically restart after teacher recovery.

Student seat tokens remain in each tab's session storage for reload. Do not share tokens, recovery codes or teacher browser access.

The teacher browser is trusted and holds complete match state. ECDH/AES-GCM envelopes protect student requests and redacted responses over Playroom. The full class code binds the teacher public-key fingerprint. Ranks/tokens are not plaintext shared state. This provides convenience classroom authority, not account authentication or independently audited anti-cheat. Malicious teachers or compromised browsers remain trusted; no always-running server or cross-device persistence is claimed.

The embedded Playroom Game ID is a public client identifier, not a secret API credential. The free development plan supports 10 unique users/day. No purchase occurs. Validate Playroom, esm.sh and hosting on the school network; GitHub was previously reported blocked there.

## Development

- `node --test tests/*.test.mjs`
- `node tools/build-browser-engine.mjs` regenerates browser rules from the tested reference authority.
- Build Unity WebGL into a fresh Builds stage using the existing Editor build command.
- `node tools/package-browser.mjs Builds/BrowserAuthorityFinal` stages `Builds/BrowserRelease/docs`.
- `node tests/browser-authority-live.mjs` runs actual Unity teacher/two students over live Playroom in one task browser. It consumes free-plan participant allowance; run deliberately.

Local preview: `python -m http.server 8090 --bind 127.0.0.1 --directory Builds/BrowserRelease/docs`, then http://127.0.0.1:8090/index.html. Keep the terminal open. No separate authority process is used.
