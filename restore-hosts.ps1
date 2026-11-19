# Devin Router hosts-file restore after the offline proof.

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell -Verb RunAs -ArgumentList ('-ExecutionPolicy Bypass -File "{0}"' -f $PSCommandPath)
    exit
}

$ErrorActionPreference = 'Stop'

$repoRoot = $PSScriptRoot
$hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
$backupPath = Join-Path $repoRoot 'hosts-backup.txt'
$hashPath = Join-Path $repoRoot 'hosts-original.sha256.txt'
$markerPath = Join-Path $repoRoot 'RESTORED-OK.txt'

if (-not (Test-Path -LiteralPath $backupPath)) {
    throw ('Hosts backup not found: {0}' -f $backupPath)
}

Copy-Item -LiteralPath $backupPath -Destination $hostsPath -Force
$restoredHash = (Get-FileHash -LiteralPath $hostsPath -Algorithm SHA256).Hash
$originalHash = if (Test-Path -LiteralPath $hashPath) { (Get-Content -LiteralPath $hashPath -Raw).Trim() } else { '' }
$hashMatches = ($originalHash -ne '') -and ($restoredHash -eq $originalHash)

ipconfig /flushdns

$timestamp = (Get-Date).ToString('o')
$markerText = @(
    'RESTORED-OK',
    ('Timestamp: {0}' -f $timestamp),
    ('Hosts: {0}' -f $hostsPath),
    ('Backup: {0}' -f $backupPath),
    ('Original SHA256: {0}' -f $originalHash),
    ('Restored SHA256: {0}' -f $restoredHash),
    ('Hash match: {0}' -f $hashMatches)
)
Set-Content -LiteralPath $markerPath -Value $markerText -Encoding ascii

if (-not $hashMatches) {
    throw 'Restored hosts SHA256 does not match the original backup hash.'
}

Write-Host ('RESTORED-OK: {0}' -f $markerPath)