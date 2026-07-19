# Docker Security Scan Script
# Scans Docker images for vulnerabilities using Trivy
# Usage: .\docker-scan.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " HMWSSB Docker Security Scan" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Docker not running" }
} catch {
    Write-Host "[ERROR] Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check if Trivy is available
$trivyAvailable = $false
try {
    trivy --version 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $trivyAvailable = $true }
} catch {}

if (-not $trivyAvailable) {
    Write-Host "[INFO] Trivy not found locally. Will use Docker-based Trivy scan." -ForegroundColor Yellow
    Write-Host ""
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$reportDir = "scan-reports"
if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Path $reportDir | Out-Null }

Write-Host "[1/4] Building server image..." -ForegroundColor Green
docker build -t hmwssb-server:scan ./server
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Server image build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "[2/4] Building client image..." -ForegroundColor Green
docker build -t hmwssb-client:scan ./client
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Client image build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "[3/4] Scanning server image for vulnerabilities..." -ForegroundColor Green
$serverReport = "$reportDir\server-scan-$timestamp.txt"

if ($trivyAvailable) {
    trivy image --severity CRITICAL,HIGH --format table hmwssb-server:scan 2>&1 | Tee-Object -FilePath $serverReport
    trivy image --severity CRITICAL,HIGH --format json --output "$reportDir\server-scan-$timestamp.json" hmwssb-server:scan
} else {
    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image --severity CRITICAL,HIGH --format table hmwssb-server:scan 2>&1 | Tee-Object -FilePath $serverReport
}

Write-Host ""
Write-Host "[4/4] Scanning client image for vulnerabilities..." -ForegroundColor Green
$clientReport = "$reportDir\client-scan-$timestamp.txt"

if ($trivyAvailable) {
    trivy image --severity CRITICAL,HIGH --format table hmwssb-client:scan 2>&1 | Tee-Object -FilePath $clientReport
    trivy image --severity CRITICAL,HIGH --format json --output "$reportDir\client-scan-$timestamp.json" hmwssb-client:scan
} else {
    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image --severity CRITICAL,HIGH --format table hmwssb-client:scan 2>&1 | Tee-Object -FilePath $clientReport
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Scan Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Reports saved to: $reportDir\" -ForegroundColor Yellow
Write-Host "  - server-scan-$timestamp.txt" -ForegroundColor Yellow
Write-Host "  - client-scan-$timestamp.txt" -ForegroundColor Yellow
Write-Host "  - server-scan-$timestamp.json" -ForegroundColor Yellow
Write-Host "  - client-scan-$timestamp.json" -ForegroundColor Yellow
Write-Host ""
