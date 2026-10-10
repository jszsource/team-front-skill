# Installs the team frontend skill, agents and command into a .claude directory.
# Usage: install.ps1 [-Target <path-to-.claude>]   (default: .\.claude)
param([string]$Target = ".\.claude")
$ErrorActionPreference = "Stop"

$Src = $PSScriptRoot
foreach ($dir in "skills", "agents", "commands") {
    New-Item -ItemType Directory -Force -Path (Join-Path $Target $dir) | Out-Null
}

foreach ($skill in Get-ChildItem -Directory (Join-Path $Src "skills")) {
    $skillDest = Join-Path $Target "skills\$($skill.Name)"
    if (Test-Path $skillDest) { Remove-Item -Recurse -Force $skillDest }
    Copy-Item -Recurse $skill.FullName (Join-Path $Target "skills")
}
Copy-Item (Join-Path $Src "agents\*.md") (Join-Path $Target "agents")
Copy-Item (Join-Path $Src "commands\*.md") (Join-Path $Target "commands")

Write-Host "Installed team-frontend + front-template skills, front-reviewer/front-refactorer agents and /front-setup into $Target"
