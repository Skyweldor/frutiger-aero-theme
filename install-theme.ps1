# =============================================================================
# Frutiger Aero Theme Suite — One-Step Extension Installer (VS Code & AGY)
# =============================================================================
$ErrorActionPreference = "Stop"

$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Package   = Get-Content -Raw (Join-Path $SourceDir 'package.json') | ConvertFrom-Json
$ExtName   = "$($Package.publisher).$($Package.name)-$($Package.version)"
$ExtPrefix = "$($Package.publisher).$($Package.name)-"

$Targets = @(
    (Join-Path $HOME ".vscode\extensions"),
    (Join-Path $HOME ".antigravity\extensions")
)

foreach ($BaseDir in $Targets) {
    if (Test-Path $BaseDir) {
        # Drop older copies of this extension so VS Code can't load a stale version.
        Get-ChildItem -Path $BaseDir -Directory -Filter "$ExtPrefix*" | ForEach-Object {
            if ($_.Name -ne $ExtName -and $_.FullName -ne $SourceDir) {
                Write-Host "  Removing old version: $($_.FullName)" -ForegroundColor DarkGray
                Remove-Item -Path $_.FullName -Recurse -Force
            }
        }
        $DestDir = Join-Path $BaseDir $ExtName
        Write-Host "Installing Frutiger Aero Theme Suite to: $DestDir" -ForegroundColor Cyan
        if (Test-Path $DestDir) {
            Remove-Item -Path $DestDir -Recurse -Force
        }
        Copy-Item -Path $SourceDir -Destination $DestDir -Recurse -Force
        Write-Host "  [OK] Installed to $DestDir" -ForegroundColor Green
    }
}

Write-Host "`nDone! Press Ctrl+K Ctrl+T in VS Code / Antigravity and select:" -ForegroundColor Yellow
Write-Host "  - Frutiger Aero (Daylight Glass)" -ForegroundColor White
Write-Host "  - Frutiger Aero (Deep Aqua)" -ForegroundColor White
