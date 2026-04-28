# SDD Framework V4 — install.ps1 (Windows PowerShell / pwsh)
#
# Usage:
#   cd your-project
#   .\sdd-framework\install.ps1
#   .\sdd-framework\install.ps1 -ProjectRoot C:\path\to\project
#   .\sdd-framework\install.ps1 -CodeDirsRegex '/(src|lib)/'
#
# Requires: PowerShell 5.1+ or pwsh 7+
# Note: Runs as standard user — uses file copy (no symlinks needed).
#
# What it does:
#   1. Copies skills/<name>/SKILL.md  -> .claude/skills/<name>/SKILL.md
#   2. Copies hooks/*                 -> .claude/hooks/
#   3. Generates .claude/settings.json with absolute hook paths
#   4. Generates CLAUDE.md from template   (skipped if already exists)

param(
  [string]$ProjectRoot = "",
  [string]$CodeDirsRegex = "/(apps|src|packages)/",
  [string]$SpecDirRegex  = "/SDD/"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# -- Locate framework dir -----------------------------------------------------
$FrameworkDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# -- Resolve project root ------------------------------------------------------
if ($ProjectRoot -eq "") {
  # Try superproject (submodule scenario)
  $super = & git -C $FrameworkDir rev-parse --show-superproject-working-tree 2>$null
  if ($LASTEXITCODE -eq 0 -and $super -ne "") {
    $ProjectRoot = $super.Trim()
  } else {
    $ProjectRoot = Split-Path -Parent $FrameworkDir
  }
}
$ProjectRoot = (Resolve-Path $ProjectRoot).Path

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗"
Write-Host "║        SDD Framework V4 — Installer (PS)         ║"
Write-Host "╚══════════════════════════════════════════════════╝"
Write-Host ""
Write-Host "  Framework : $FrameworkDir"
Write-Host "  Project   : $ProjectRoot"
Write-Host ""

# -- Create target directories -------------------------------------------------
New-Item -ItemType Directory -Force -Path "$ProjectRoot\.claude\skills" | Out-Null
New-Item -ItemType Directory -Force -Path "$ProjectRoot\.claude\hooks"  | Out-Null

# -- Install Skills ------------------------------------------------------------
Write-Host "▸ Installing Skills → .claude\skills\"
Get-ChildItem "$FrameworkDir\skills" -Directory | ForEach-Object {
  $skillName = $_.Name
  $dst = "$ProjectRoot\.claude\skills\$skillName"
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  Copy-Item "$($_.FullName)\SKILL.md" "$dst\SKILL.md" -Force
  Write-Host "    ✓ $skillName\SKILL.md"
}

# -- Install Hooks -------------------------------------------------------------
Write-Host ""
Write-Host "▸ Installing Hooks → .claude\hooks\"
@("session-reset.sh", "spec-first-guard.sh", "spec-touched-marker.sh", "parse-hook-input.js") | ForEach-Object {
  Copy-Item "$FrameworkDir\hooks\$_" "$ProjectRoot\.claude\hooks\$_" -Force
  Write-Host "    ✓ $_"
}

# -- Generate settings.json ---------------------------------------------------
Write-Host ""
Write-Host "▸ Generating .claude\settings.json"

# Normalize to forward slashes for bash compatibility
$HooksDir = "$ProjectRoot\.claude\hooks" -replace '\\', '/'
$ProjectRootFwd = $ProjectRoot -replace '\\', '/'

$settingsJson = @"
{
  "env": {
    "SDD_PROJECT_ROOT": "$ProjectRootFwd",
    "SDD_CODE_DIRS_REGEX": "$CodeDirsRegex",
    "SDD_SPEC_DIR_REGEX": "$SpecDirRegex"
  },
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash $HooksDir/session-reset.sh"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bash $HooksDir/spec-first-guard.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bash $HooksDir/spec-touched-marker.sh"
          }
        ]
      }
    ]
  }
}
"@

$settingsJson | Out-File -FilePath "$ProjectRoot\.claude\settings.json" -Encoding utf8 -NoNewline
Write-Host "    ✓ .claude\settings.json"

# -- Generate CLAUDE.md -------------------------------------------------------
Write-Host ""
$claudeMd = "$ProjectRoot\CLAUDE.md"
$template  = "$FrameworkDir\templates\CLAUDE.md.template"

if (Test-Path $claudeMd) {
  Write-Host "▸ CLAUDE.md already exists — skipped"
  Write-Host "    ⚠  To reset: del CLAUDE.md, then re-run install.ps1"
} else {
  $frameworkFwd = $FrameworkDir -replace '\\', '/'
  (Get-Content $template -Raw) -replace '\{\{FRAMEWORK_DIR\}\}', $frameworkFwd |
    Out-File -FilePath $claudeMd -Encoding utf8 -NoNewline
  Write-Host "▸ CLAUDE.md generated from template"
  Write-Host "    ✓ Fill in remaining {{PLACEHOLDER}} values before first use"
}

# -- .gitignore advice --------------------------------------------------------
$gitignore = "$ProjectRoot\.gitignore"
$needsGitignore = $false
if (Test-Path $gitignore) {
  $content = Get-Content $gitignore -Raw
  if (-not $content.Contains(".session-spec-touched")) { $needsGitignore = $true }
} else {
  $needsGitignore = $true
}

if ($needsGitignore) {
  Write-Host ""
  Write-Host "▸ Add to .gitignore (not yet present):"
  Write-Host "    .claude/.session-spec-touched"
  Write-Host "    .claude/settings.json"
}

# -- Done ---------------------------------------------------------------------
Write-Host ""
Write-Host "══════════════════════════════════════════════════"
Write-Host "  Installation complete!"
Write-Host ""
Write-Host "  Next steps:"
Write-Host "  1. Edit CLAUDE.md — fill in {{PROJECT_NAME}}, {{TECH_STACK}}, etc."
if ($needsGitignore) {
  Write-Host "  2. Add the .gitignore entries shown above"
  Write-Host "  3. Start a new Claude Code session to activate hooks"
  Write-Host "  4. Run /sdd-init-project or /sdd-implement-feature"
} else {
  Write-Host "  2. Start a new Claude Code session to activate hooks"
  Write-Host "  3. Run /sdd-init-project or /sdd-implement-feature"
}
Write-Host ""
Write-Host "  To update after submodule upgrade:"
Write-Host "    git submodule update --remote sdd-framework"
Write-Host "    .\sdd-framework\install.ps1"
Write-Host "══════════════════════════════════════════════════"
