$ErrorActionPreference = "Stop"

$Proyecto = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Proyecto

Write-Host ""
Write-Host "Instalando el motor de compresion..." -ForegroundColor Cyan

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "No se encontro npm. Instala Node.js LTS y volve a ejecutar este archivo."
}

if (-not (Test-Path "package.json")) {
  npm init -y
}

npm install --save-exact `
  @ffmpeg/ffmpeg@0.12.15 `
  @ffmpeg/core@0.12.10

$WrapperDestino = Join-Path $Proyecto "vendor\ffmpeg\wrapper"
$CoreDestino = Join-Path $Proyecto "vendor\ffmpeg\core"

New-Item `
  -ItemType Directory `
  -Force `
  -Path $WrapperDestino | Out-Null

New-Item `
  -ItemType Directory `
  -Force `
  -Path $CoreDestino | Out-Null

Get-ChildItem `
  "node_modules\@ffmpeg\ffmpeg\dist\esm\*.js" |
  Copy-Item `
    -Destination $WrapperDestino `
    -Force

Copy-Item `
  "node_modules\@ffmpeg\core\dist\esm\ffmpeg-core.js" `
  $CoreDestino `
  -Force

Copy-Item `
  "node_modules\@ffmpeg\core\dist\esm\ffmpeg-core.wasm" `
  $CoreDestino `
  -Force

if (-not (Test-Path ".gitignore")) {
  New-Item `
    -ItemType File `
    -Path ".gitignore" | Out-Null
}

$GitIgnore = Get-Content ".gitignore" -ErrorAction SilentlyContinue

if ($GitIgnore -notcontains "node_modules/") {
  Add-Content ".gitignore" "`nnode_modules/"
}

Write-Host ""
Write-Host "Motor instalado correctamente." -ForegroundColor Green
Write-Host ""
Write-Host "Se creo la carpeta:" -ForegroundColor White
Write-Host "vendor\ffmpeg" -ForegroundColor Yellow
Write-Host ""
Write-Host "No subas node_modules a Git." -ForegroundColor White
Write-Host "Si debes subir vendor\ffmpeg, porque contiene los archivos que usara Vercel." -ForegroundColor White
Write-Host ""
