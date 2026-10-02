# Publishing preparation

Authorized target: public worthingtonjg/HistoryStratego. Clean export: ignored `Builds/PublicRepository`. Original local history remains untouched. Historical screenshots, diagnostic logs and private sessions are excluded; docs contains only static release assets.

Existing Git LFS tracks source PNGs and Unity data/wasm. Use **Pages GitHub Actions**, not branch /docs publishing, which would serve LFS pointers. The prepared workflow materializes LFS, rejects pointer files under docs and uploads actual bytes. Actions are pinned to resolved SHAs. No software or paid plan was installed.

Public repository https://github.com/worthingtonjg/HistoryStratego was created through the user's existing signed-in Edge session. Its public visibility and empty state were confirmed with an unauthenticated GitHub API read. Pages source was set to GitHub Actions and verified after reloading settings. The task-created tab was closed; original browser tabs were preserved.

Publishing remains blocked only on local Git authentication: a noninteractive credential check found no usable existing Git credential. No OAuth grant, token generation, software installation or credential extraction was performed. No commits have been pushed and the Pages site is not deployed.

The clean export now has origin configured. In `Builds/PublicRepository`, the user can run `git push -u origin main` and complete the existing Git Credential Manager sign-in themselves. Then verify the Pages workflow and https://worthingtonjg.github.io/HistoryStratego/. The site URL remains a target, not a verified live site. Production MIME types, Unity load, classroom join and school-network access still require deployment verification.

Runtime is static Unity + Playroom with teacher-browser authority and encrypted local recovery; see BROWSER_RELEASE.md. Node source remains development/reference code.
