param([string]$UnityData='C:\Program Files\Unity\Hub\Editor\6000.5.2f1\Editor\Data')
$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force docs\evidence | Out-Null
$refs=Get-ChildItem (Join-Path $UnityData 'Managed\UnityEngine') -Filter '*.dll'
$common=@('/nologo','/nostdlib+','/target:library',('/reference:"'+$UnityData+'\NetStandard\ref\2.1.0\netstandard.dll"'))
$common+=$refs | ForEach-Object { '/reference:"'+$_.FullName+'"' }
$compiler=Join-Path $UnityData 'DotNetSdk\sdk\8.0.318\Roslyn\bincore\csc.dll'
$runtime=Join-Path $UnityData 'NetCoreRuntime\dotnet.exe'
foreach($mode in @('Editor','WebGL')) {
 $options=$common
 if($mode -eq 'Editor') {$options+='/define:UNITY_EDITOR'} else {$options+='/define:UNITY_WEBGL'}
 $options+='/out:docs/evidence/History'+$mode+'.dll'
 $options+=Get-ChildItem Assets/Scripts -Filter '*.cs' | ForEach-Object FullName
 if($mode -eq 'Editor') {$options+=Get-ChildItem Assets/Editor -Filter '*.cs' | ForEach-Object FullName}
 $rsp='docs/evidence/compile-'+$mode+'.rsp'
 Set-Content -Encoding utf8 $rsp $options
 & $runtime $compiler ('@'+$rsp)
 if($LASTEXITCODE -ne 0) {throw "$mode source compilation failed"}
 Write-Output "PASS: $mode C# source compiled against installed Unity assemblies."
}
Write-Output 'This is not an Editor import or WebGL build.'
