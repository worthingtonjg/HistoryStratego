param([switch]$Check)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$sdk = (& dotnet --list-sdks | Select-Object -Last 1)
if ($sdk -notmatch '^([^ ]+) \[(.+)\]$') {
	throw 'An installed .NET SDK is required.'
}
$roslyn = Join-Path (Join-Path $Matches[2] $Matches[1]) 'Roslyn/bincore'
Add-Type -Path (Join-Path $roslyn 'Microsoft.CodeAnalysis.dll')
Add-Type -Path (Join-Path $roslyn 'Microsoft.CodeAnalysis.CSharp.dll')
$normalize = [Microsoft.CodeAnalysis.SyntaxNodeExtensions].GetMethods() |
	Where-Object { $_.Name -eq 'NormalizeWhitespace' -and $_.GetParameters().Count -eq 4 }
$normalize = $normalize.MakeGenericMethod([Microsoft.CodeAnalysis.SyntaxNode])
$options = [Microsoft.CodeAnalysis.CSharp.CSharpParseOptions]::Default.WithPreprocessorSymbols([string[]]@('UNITY_WEBGL'))
$changed = 0

Push-Location $repo
try {
	foreach ($file in (& git ls-files '*.cs')) {
		$path = Join-Path $repo $file
		$original = [IO.File]::ReadAllText($path)
		$tree = [Microsoft.CodeAnalysis.CSharp.CSharpSyntaxTree]::ParseText($original, $options)
		$root = $tree.GetRoot()
		$formatted = $normalize.Invoke($null, @($root, "`t", "`n", $false)).ToFullString().TrimEnd() + "`n"
		$newRoot = [Microsoft.CodeAnalysis.CSharp.CSharpSyntaxTree]::ParseText($formatted, $options).GetRoot()

		# Preserve literal contents and token order, not just compilability.
		$before = @($root.DescendantTokens() | ForEach-Object { "$($_.RawKind):$($_.Text)" }) -join [char]0
		$after = @($newRoot.DescendantTokens() | ForEach-Object { "$($_.RawKind):$($_.Text)" }) -join [char]0
		if ($before -cne $after -or ($original -replace '\s', '') -cne ($formatted -replace '\s', '')) {
			throw "Formatting changed non-whitespace content: $file"
		}
		if ($original -cne $formatted) {
			$changed++
			if (-not $Check) {
				[IO.File]::WriteAllText($path, $formatted, [Text.UTF8Encoding]::new($false))
			}
		}
	}
}
finally {
	Pop-Location
}
Write-Output "C# files needing formatting: $changed"
if ($Check -and $changed -gt 0) {
	exit 1
}
