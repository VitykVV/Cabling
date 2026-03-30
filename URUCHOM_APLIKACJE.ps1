param(
  [ValidateSet('prod', 'dev')]
  [string]$Mode = 'prod'
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Ensure-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Nie znaleziono polecenia '$Name'. Zainstaluj Node.js z npm i uruchom skrypt ponownie."
  }
}

function Ensure-Dependencies {
  if (-not (Test-Path '.\node_modules')) {
    Write-Host 'Instaluje zaleznosci npm...'
    npm install
  }
}

Ensure-Command 'node'
Ensure-Command 'npm'
Ensure-Dependencies

if ($Mode -eq 'prod') {
  Write-Host 'Buduje frontend...'
  npm run build
  Write-Host ''
  Write-Host 'Aplikacja bedzie dostepna pod adresem: http://127.0.0.1:4321'
  Write-Host 'Zatrzymanie: Ctrl+C'
  Write-Host ''
  npm run start
  exit $LASTEXITCODE
}

Write-Host 'Tryb developerski uruchamia watcher frontendu i backend.'
Write-Host 'Aplikacja bedzie dostepna pod adresem: http://127.0.0.1:4321'
Write-Host 'Zatrzymanie: Ctrl+C'
Write-Host ''
npm run dev
exit $LASTEXITCODE
