# Devin Router hosts-file offline proof.
# Domains blocked (from AUDIT.md and docs/rea.md):
# - server.codeium.com
# - server-beta.codeium.com
# - server-staging.codeium.com
# - eu.windsurf.com
# - windsurf.fedstart.com
# - app.devin.ai
# - app.beta.devin.ai
# - register.windsurf.com
# - marketplace.windsurf.com
# - windsurf-stable.codeium.com
# - codeium.com

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
$markerPath = Join-Path $repoRoot 'BLOCKED-OK.txt'
$domains = @(
    'server.codeium.com',
    'server-beta.codeium.com',
    'server-staging.codeium.com',
    'eu.windsurf.com',
    'windsurf.fedstart.com',
    'app.devin.ai',
    'app.beta.devin.ai',
    'register.windsurf.com',
    'marketplace.windsurf.com',
    'windsurf-stable.codeium.com',
    'codeium.com'
)

Copy-Item -LiteralPath $hostsPath -Destination $backupPath -Force
$originalHash = (Get-FileHash -LiteralPath $hostsPath -Algorithm SHA256).Hash
Set-Content -LiteralPath $hashPath -Value $originalHash -Encoding ascii

$timestamp = (Get-Date).ToString('o')
$blockText = @(
    '',
    '# Devin Router offline proof - Cognition/Windsurf/Codeium domains',
    ('# Blocked: {0}' -f $timestamp)
) + ($domains | ForEach-Object { '127.0.0.1 {0}' -f $_ })
Add-Content -LiteralPath $hostsPath -Value ($blockText -join "`r`n") -Encoding ascii

ipconfig /flushdns

$markerText = @(
    'BLOCKED-OK',
    ('Timestamp: {0}' -f $timestamp),
    ('Hosts: {0}' -f $hostsPath),
    ('Backup: {0}' -f $backupPath),
    ('Original SHA256: {0}' -f $originalHash),
    'Domains:'
) + $domains
Set-Content -LiteralPath $markerPath -Value $markerText -Encoding ascii

Write-Host ('BLOCKED-OK: {0}' -f $markerPath)