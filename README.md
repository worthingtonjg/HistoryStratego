# Civil War: Hidden Orders

Unity WebGL + Playroom classroom strategy game. No custom backend required at runtime.

See [classroom instructions](development-docs/BROWSER_RELEASE.md), [verification](development-docs/BROWSER_VERIFICATION.md) and [publishing](development-docs/PUBLISHING.md).

Local preview: `python -m http.server 8090 --bind 127.0.0.1 --directory docs`, then http://127.0.0.1:8090/index.html. Internet access to Playroom is required.

Run `node --test tests/*.test.mjs`. Pages uses Actions with LFS materialization; branch-based publishing would serve pointers. The teacher browser is trusted; this is not account-authenticated anti-cheat. Free development limit: 10 unique users/day.
