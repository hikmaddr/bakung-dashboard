Param(
  [int]$Port = 3000
)

Write-Host "== Deploy (Windows) with PM2 ==" -ForegroundColor Cyan

# Ensure PM2 installed
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
  Write-Host "PM2 not found. Installing globally..." -ForegroundColor Yellow
  npm i -g pm2
}

# Set environment
$env:NODE_ENV = 'production'
$env:PORT = "$Port"
Write-Host "Using PORT=$env:PORT, NODE_ENV=$env:NODE_ENV" -ForegroundColor Green

# Install dependencies
if (Test-Path "package-lock.json") {
  Write-Host "Running npm ci..." -ForegroundColor Cyan
  npm ci
} else {
  Write-Host "Running npm install..." -ForegroundColor Cyan
  npm install
}

# Prisma migrations (optional if schema changed)
if (Test-Path "prisma\\schema.prisma") {
  Write-Host "Applying Prisma migrations..." -ForegroundColor Cyan
  npx prisma migrate deploy
}

# Build production
Write-Host "Building production..." -ForegroundColor Cyan
npm run build

# Start or restart via PM2
Write-Host "Starting app with PM2..." -ForegroundColor Cyan
try {
  pm2 start ecosystem.config.js
} catch {
  pm2 restart tailadmin --update-env
}

pm2 save

Write-Host "Done. To auto-start at boot, install pm2-windows-service:" -ForegroundColor Yellow
Write-Host "  npm i -g pm2-windows-service; pm2-service-install" -ForegroundColor Yellow