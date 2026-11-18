$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$stage = Join-Path $PSScriptRoot "assets"
if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null
$exeSrc = Join-Path $root "local-app\bin\devin-router-local-v7-gui.exe"
if (-not (Test-Path $exeSrc)) { $exeSrc = Join-Path $root "local-app\bin\devin-router-local-v7.exe" }
if (-not (Test-Path $exeSrc)) { $exeSrc = Join-Path $root "local-app\bin\devin-router-local.exe" }
Copy-Item $exeSrc (Join-Path $stage "devin-router-local.exe") -Force
$gw = Join-Path $stage "gateway"
New-Item -ItemType Directory -Force $gw | Out-Null
Copy-Item (Join-Path $root "gateway\src") (Join-Path $gw "src") -Recurse -Force
Copy-Item (Join-Path $root "gateway\package.json") (Join-Path $gw "package.json") -Force
if (Test-Path (Join-Path $root "gateway\README.md")) { Copy-Item (Join-Path $root "gateway\README.md") (Join-Path $gw "README.md") -Force }
$nm = Join-Path $root "gateway\node_modules"
$stageNm = Join-Path $gw "node_modules"
New-Item -ItemType Directory -Force $stageNm | Out-Null
robocopy $nm $stageNm /E /XD better-sqlite3 /NFL /NDL /NJH /NJS /NP | Out-Null
$bsrc = Join-Path $nm "better-sqlite3"
$bdst = Join-Path $stageNm "better-sqlite3"
New-Item -ItemType Directory -Force $bdst | Out-Null
Copy-Item (Join-Path $bsrc "package.json") (Join-Path $bdst "package.json") -Force
Copy-Item (Join-Path $bsrc "lib") (Join-Path $bdst "lib") -Recurse -Force
New-Item -ItemType Directory -Force (Join-Path $bdst "build\Release") | Out-Null
Copy-Item (Join-Path $bsrc "build\Release\better_sqlite3.node") (Join-Path $bdst "build\Release\better_sqlite3.node") -Force
Set-Location $PSScriptRoot
go build -o (Join-Path $root "local-app\bin\DevinRouterSetup.exe") .
Write-Output "BUILT"
Get-Item (Join-Path $root "local-app\bin\DevinRouterSetup.exe") | Select-Object Length,FullName | Format-List
