# openSDD V5: explicit target, cross-platform Node installer.
param(
  [Parameter(Mandatory = $true)][string]$ProjectRoot,
  [ValidateSet('claude','codex','kimi','opencode-v1','opencode-v2')][string]$HostName = 'claude',
  [string]$KimiConfig = ''
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$installerArgs = @((Join-Path $PSScriptRoot 'runtime/cli.mjs'), 'install', '--project', $ProjectRoot, '--host', $HostName)
if ($KimiConfig) { $installerArgs += @('--kimi-config', $KimiConfig) }
& node @installerArgs
if ($LASTEXITCODE -ne 0) { throw "openSDD installation failed (exit $LASTEXITCODE)" }
