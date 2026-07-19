# Setup script for HMWSSB Digital Signature System (PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "=== HMWSSB Digital Signature System Setup ===" -ForegroundColor Cyan

# Check Node.js version
try {
  $nodeVersion = (node -v) -replace 'v', '' -split '\.' | Select-Object -First 1
  if ([int]$nodeVersion -lt 20) {
    Write-Host "Error: Node.js v20+ is required. Current: $(node -v)" -ForegroundColor Red
    exit 1
  }
  Write-Host "Node.js version: $(node -v) OK" -ForegroundColor Green
} catch {
  Write-Host "Error: Node.js is not installed." -ForegroundColor Red
  exit 1
}

# Install server dependencies
Write-Host "Installing server dependencies..." -ForegroundColor Yellow
Push-Location server; npm install; Pop-Location

# Install client dependencies
Write-Host "Installing client dependencies..." -ForegroundColor Yellow
Push-Location client; npm install; Pop-Location

# Generate .env if missing
if (-not (Test-Path server\.env)) {
  Write-Host "Generating server\.env from template..." -ForegroundColor Yellow
  Copy-Item server\.env.example server\.env
  $bytes = New-Object Byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  $jwtSecret = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
  (Get-Content server\.env) -replace "^JWT_SECRET=.*", "JWT_SECRET=$jwtSecret" | Set-Content server\.env
  Write-Host "Generated JWT_SECRET" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the application:"
Write-Host "  Docker:  docker compose up --build"
Write-Host "  Local:   Start terminal 1: cd server; npm run dev"
Write-Host "           Start terminal 2: cd client; npm run dev"
Write-Host ""
