# Source formatting

Handwritten C#, JavaScript, HTML, and CSS use tabs (display width 4), LF endings, and expanded statement blocks. Generated Unity scenes, build output, and vendor code are excluded.

Run the installed syntax-aware formatters from the repository:

```powershell
pwsh -NoProfile -File tools/format-csharp.ps1
node tools/format-web.mjs
```

Check without writing:

```powershell
pwsh -NoProfile -File tools/format-csharp.ps1 -Check
node tools/format-web.mjs --check
npm test
```

The C# helper uses Roslyn from an installed .NET SDK. The web helper uses TypeScript and HTML/CSS formatting services from the installed VS Code distribution; it reports a missing prerequisite rather than downloading packages. Both validate syntax/content preservation before writing. Unity builds and browser fixtures remain separate runtime verification steps.
