"""Prepare a fresh public snapshot; never copy local history or runtime evidence."""
from pathlib import Path
import shutil, subprocess, re, json
root=Path(__file__).resolve().parents[1]
out=root/'Builds/PublicRepository'
if out.exists():
    raise SystemExit('Export already exists; inspect before replacing it.')
out.mkdir(parents=True)
tracked=subprocess.check_output(['git','ls-files'],cwd=root,text=True).splitlines()
prefixes=('Assets/','Packages/','ProjectSettings/','server/','web/','browser/')
chosen=[p for p in tracked if p.startswith(prefixes) and not p.startswith('web/tabletop/')]
chosen += [p for p in tracked if p.startswith('tests/') and not p.endswith(('.png','.jpg','.dll'))]
chosen += ['package.json','.gitignore','README.md']
chosen += ['tools/'+p for p in ['build-browser-engine.mjs','package-browser.mjs','demo-policy.mjs','mobility-policy.mjs','public-knowledge.mjs','human-opponent.mjs','format-web.mjs','format-csharp.ps1','export-public.py']]
for name in sorted(set(chosen)):
    src=root/name
    if src.is_file():
        dst=out/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
shutil.copytree(root/'Builds/BrowserRelease/docs',out/'docs')
for name in ['BROWSER_VERIFICATION.md','PUBLISHING.md','RULES.md','PORTRAITS.md','commander-portraits.json','FORMATTING.md']:
    dst=out/'development-docs'/name;dst.parent.mkdir(exist_ok=True);shutil.copy2(root/'docs'/name,dst)
p=out/'tests/portraits.test.mjs';p.write_text(p.read_text(encoding='utf8').replace('docs/commander-portraits.json','development-docs/commander-portraits.json'),encoding='utf8')
p=out/'README.md';p.write_text('# Civil War: Hidden Orders\n\nUnity WebGL classroom strategy game with Playroom networking and teacher-browser authority. No custom backend is required at runtime.\n\nRead [verification](development-docs/BROWSER_VERIFICATION.md) and [publishing](development-docs/PUBLISHING.md).\n\nLocal static preview: `python -m http.server 8090 --bind 127.0.0.1 --directory docs`, then http://127.0.0.1:8090/index.html. Playroom internet access is required.\n\n`docs` contains the materialized static app. Source Unity assets are in Assets, browser authority in browser, and the older Node authority in server is development/reference code. Run `node --test tests/*.test.mjs` for regression tests.\n\nPages deployment uses Actions with LFS materialization; do not serve LFS pointers through branch-based Pages. Teacher access is convenience classroom control, not account-authenticated anti-cheat. The free Playroom development allowance is 10 unique users/day.\n',encoding='utf8')
(out/'.gitattributes').write_text('Assets/**/*.png filter=lfs diff=lfs merge=lfs -text\ndocs/Build/*.data filter=lfs diff=lfs merge=lfs -text\ndocs/Build/*.wasm filter=lfs diff=lfs merge=lfs -text\n')
workflow=out/'.github/workflows/pages.yml';workflow.parent.mkdir(parents=True)
workflow.write_text("""name: Deploy static Unity classroom
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
        with:
          lfs: true
      - name: Materialize and verify static files
        run: |
          git lfs pull
          git lfs checkout
          python3 - <<'PY'
          from pathlib import Path
          for path in Path('docs').rglob('*'):
              if path.is_file():
                  with path.open('rb') as f:
                      assert not f.read(80).startswith(b'version https://git-lfs.github.com/spec/v1'), str(path)
          assert Path('docs/index.html').is_file()
          PY
      - uses: actions/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b
      - uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa
        with:
          path: docs
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e
""")
# Actual known local credentials are compared in memory, never emitted.
secrets=[]
log=root/'Logs/local-server.log'
if log.exists():
    secrets += re.findall(r'Teacher key \(keep private\): ([^\r\n]+)',log.read_text(encoding='utf8',errors='ignore'))
for p in (root/'Logs').glob('api-opponent-*.json'):
    try:
        data=json.loads(p.read_text(encoding='utf8'))
        if data.get('token'): secrets.append(data['token'])
    except (ValueError,UnicodeError): pass
files=list(p for p in out.rglob('*') if p.is_file())
for p in files:
    b=p.read_bytes()
    assert not any(s.encode() in b for s in secrets if len(s)>8), 'Private credential found in '+str(p.relative_to(out))
    if p.suffix in ['.mjs','.js','.json','.md','.yml','.cs','.html']:
        assert not re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}',b), 'Potential provider credential in '+str(p.relative_to(out))
print('Clean export:',len(files),'files;',round(sum(p.stat().st_size for p in files)/1048576,1),'MiB; credential scans passed.')
