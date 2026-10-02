# Publishing preparation

Authorized target: public worthingtonjg/HistoryStratego. Clean export: ignored `Builds/PublicRepository`. Original local history remains untouched. Historical screenshots, diagnostic logs and private sessions are excluded; docs contains only static release assets.

Existing Git LFS tracks source PNGs and Unity data/wasm. Use **Pages GitHub Actions**, not branch /docs publishing, which would serve LFS pointers. The prepared workflow materializes LFS, rejects pointer files under docs and uploads actual bytes. Actions are pinned to resolved SHAs. No software or paid plan was installed.

Publishing is blocked: the available GitHub connector has no repository-create or Pages-configuration operation, gh is absent, and noninteractive local Git credentials were unavailable. No remote repository, push or deployment was performed. The user needs to create the empty public repository, authenticate local Git and enable Pages with GitHub Actions. Browser sign-in does not authenticate Git; do not copy cookies or print credentials.

Then from the clean export add origin `https://github.com/worthingtonjg/HistoryStratego.git`, push main and verify the workflow and https://worthingtonjg.github.io/HistoryStratego/. That URL is a target, not a verified live site. Verify production MIME types, Unity load, classroom join and school-network access after deployment.

Runtime is static Unity + Playroom with teacher-browser authority and encrypted local recovery; see BROWSER_RELEASE.md. Node source remains development/reference code.
