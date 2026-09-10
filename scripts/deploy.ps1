# Build le web, sync Capacitor, build l'APK debug, et l'installe/lance sur
# l'appareil Android connecté (si il y en a un). Usage : .\scripts\deploy.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Invoke-Step {
    param([string]$Description, [scriptblock]$Action)
    Write-Host "==> $Description" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "$Description a echoue (code $LASTEXITCODE)"
    }
}

$version = (Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json).version
Write-Host "Version : $version" -ForegroundColor Cyan

Invoke-Step "npm run build" { npm run build }
Invoke-Step "npx cap sync android" { npx cap sync android }

Set-Location "$root\android"
Invoke-Step "gradlew assembleDebug" { .\gradlew.bat assembleDebug }
Set-Location $root

$apk = Join-Path $root "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apk)) {
    throw "APK introuvable a $apk"
}
Write-Host "APK genere : $apk" -ForegroundColor Green

$adb = $null
if ($env:ANDROID_HOME) {
    $candidate = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
    if (Test-Path $candidate) { $adb = $candidate }
}
if (-not $adb) {
    $cmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($cmd) { $adb = $cmd.Source }
}

if (-not $adb) {
    Write-Host "adb introuvable (ANDROID_HOME non defini et adb absent du PATH) - build termine, installe l'APK manuellement." -ForegroundColor Yellow
    exit 0
}

$devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\bdevice$' }
if (-not $devices) {
    Write-Host "Aucun appareil/emulateur connecte - build termine, rien a installer." -ForegroundColor Yellow
    exit 0
}

Invoke-Step "adb install -r" { & $adb install -r $apk }
Invoke-Step "adb start MainActivity" { & $adb shell am start -n com.pdcaux.japplan/.MainActivity }

Write-Host "Deploiement termine." -ForegroundColor Green
