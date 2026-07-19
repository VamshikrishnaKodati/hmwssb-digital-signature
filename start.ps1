# Start script for local development (PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "Starting HMWSSB Digital Signature System..." -ForegroundColor Cyan

# Check if .env exists
if (-not (Test-Path server\.env)) {
  Write-Host "No .env found. Running setup first..." -ForegroundColor Yellow
  .\setup.ps1
}

Write-Host "Starting server on port 5000..." -ForegroundColor Green
$serverProc = Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run","dev" -WorkingDirectory "server" -PassThru

Start-Sleep -Seconds 3

Write-Host "Starting client on port 5173..." -ForegroundColor Green
$clientProc = Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run","dev" -WorkingDirectory "client" -PassThru

Write-Host ""
Write-Host "Server: http://localhost:5000"
Write-Host "Client: http://localhost:5173"
Write-Host "Health: http://localhost:5000/api/health"
Write-Host ""
Write-Host "Press Ctrl+C to stop..."

try {
  $serverProc.WaitForExit()
} finally {
  if (-not $serverProc.HasExited) { $serverProc.Kill() }
  if (-not $clientProc.HasExited) { $clientProc.Kill() }
}
