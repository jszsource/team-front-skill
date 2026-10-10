# Installs the team frontend skills, agents and command into a .claude directory.
# Usage: install.ps1 [-Target <path-to-.claude>]   (default: .\.claude)
#
# - Writes the package version to <skill>\.installed-version.
# - If an installed skill folder differs from the one being installed (local
#   edits or an older version), it is backed up to
#   <target>\.team-front-backup\<skill>-<old-version> before being replaced.
# - A differing installed agent/command/hook file is backed up to
#   <target>\.team-front-backup\<agents|commands|hooks>-<old-version>\<file>.
# - Registers the front-check PostToolUse hook in <target>\settings.json
#   (needs node; other settings are kept).
# Keep behaviour identical to install.sh.
param([string]$Target = ".\.claude")
$ErrorActionPreference = "Stop"

$Src = $PSScriptRoot
$Stamp = ".installed-version"
$Version = (Get-Content -Raw (Join-Path $Src "VERSION")).Trim()
$BackupRoot = Join-Path $Target ".team-front-backup"

# Relative path + SHA256 of every file under $Dir, excluding the version stamp.
function Get-TreeHashes([string]$Dir) {
    $root = (Resolve-Path $Dir).Path.TrimEnd('\', '/')
    Get-ChildItem -Recurse -File -Force $root |
        Where-Object { $_.Name -ne $Stamp } |
        ForEach-Object {
            $rel = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
            "$rel|$((Get-FileHash -Algorithm SHA256 $_.FullName).Hash)"
        } | Sort-Object
}

function Test-SameTree([string]$A, [string]$B) {
    return ((@(Get-TreeHashes $A) -join "`n") -eq (@(Get-TreeHashes $B) -join "`n"))
}

function Read-Stamp([string]$Path) {
    return (Get-Content -Raw $Path).Trim()
}

foreach ($dir in "skills", "agents", "commands", "hooks") {
    New-Item -ItemType Directory -Force -Path (Join-Path $Target $dir) | Out-Null
}

$OldVersion = "none"
$tfDest = Join-Path $Target "skills/team-frontend"
if (Test-Path (Join-Path $tfDest $Stamp)) {
    $OldVersion = Read-Stamp (Join-Path $tfDest $Stamp)
} elseif (Test-Path $tfDest) {
    $OldVersion = "unknown"
}

foreach ($skill in Get-ChildItem -Directory (Join-Path $Src "skills")) {
    $skillDest = Join-Path $Target "skills/$($skill.Name)"
    if (Test-Path $skillDest) {
        $prev = "unknown"
        if (Test-Path (Join-Path $skillDest $Stamp)) { $prev = Read-Stamp (Join-Path $skillDest $Stamp) }
        if (-not (Test-SameTree $skill.FullName $skillDest)) {
            $backup = Join-Path $BackupRoot "$($skill.Name)-$prev"
            if (Test-Path $backup) { $backup = "$backup-$(Get-Date -Format 'yyyyMMddHHmmss')" }
            New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
            Copy-Item -Recurse $skillDest $backup
            if ($prev -eq $Version) {
                Write-Host "WARNING: local modifications in $skillDest (v$prev) - backed up to $backup"
            } else {
                Write-Host "WARNING: $skillDest (v$prev) differs from v$Version (older version and/or local edits) - backed up to $backup"
            }
        }
        Remove-Item -Recurse -Force $skillDest
    }
    Copy-Item -Recurse $skill.FullName (Join-Path $Target "skills")
    # LF line ending, no BOM: identical to install.sh output.
    [System.IO.File]::WriteAllText((Join-Path (Resolve-Path $skillDest).Path $Stamp), "$Version`n")
}
# Agents, commands and the hook script: back up a differing installed file before overwriting it.
foreach ($kind in "agents", "commands", "hooks") {
    foreach ($file in Get-ChildItem -File (Join-Path $Src "$kind/*") -Include "*.md", "*.mjs") {
        $dest = Join-Path $Target "$kind/$($file.Name)"
        if ((Test-Path $dest) -and ((Get-FileHash $file.FullName).Hash -ne (Get-FileHash $dest).Hash)) {
            $backup = Join-Path $BackupRoot "$kind-$OldVersion/$($file.Name)"
            if (Test-Path $backup) { $backup = "$backup.$(Get-Date -Format 'yyyyMMddHHmmss')" }
            New-Item -ItemType Directory -Force -Path (Split-Path $backup) | Out-Null
            Copy-Item $dest $backup
            Write-Host "WARNING: $dest differs from v$Version - backed up to $backup"
        }
        Copy-Item $file.FullName $dest
    }
}

if (Get-Command node -ErrorAction SilentlyContinue) {
    & node (Join-Path $Src "scripts/hook-settings.mjs") add $Target
    if ($LASTEXITCODE -ne 0) { throw "hook-settings.mjs failed" }
} else {
    Write-Host "WARNING: node not found - hooks/front-check.mjs copied but not registered in $Target\settings.json"
}

Write-Host "team-front-skill: $OldVersion -> $Version"
Write-Host "Installed team-frontend + front-template skills, front-reviewer/front-refactorer agents, /front-setup and the front-check hook into $Target"
