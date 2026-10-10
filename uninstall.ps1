# Removes the team frontend skills, agents and command from a .claude directory.
# Usage: uninstall.ps1 [-Target <path-to-.claude>]   (default: .\.claude)
# Only removes files installed by this package; backups in .team-front-backup are kept.
# Keep behaviour identical to uninstall.sh.
param([string]$Target = ".\.claude")
$ErrorActionPreference = "Stop"

$items = @(
    "skills/team-frontend",
    "skills/front-template",
    "agents/front-reviewer.md",
    "agents/front-refactorer.md",
    "commands/front-setup.md"
)
foreach ($item in $items) {
    $path = Join-Path $Target $item
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path
        Write-Host "Removed $path"
    }
}

Write-Host "Uninstalled team-front-skill from $Target"
