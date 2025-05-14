# build.ps1

$ErrorActionPreference = "Stop"

# Detect OS
$runningOnWindows = [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)

# Define paths
$backendPath = "backend-service-rust"
$frontendPath = "carpaintr-front"
$frontendDistPath = Join-Path $frontendPath "dist"
$staticTargetPath = Join-Path $backendPath "static"
$buildOutputPath = "build"
$zipOutput = "carpaintr.zip"

# Determine binary name based on platform
$binaryBaseName = "rust-web-service"
$binaryName = if ($runningOnWindows) { "$binaryBaseName.exe" } else { $binaryBaseName }

# Clean up build output
if (Test-Path $buildOutputPath) {
    Remove-Item $buildOutputPath -Recurse -Force
}
New-Item -ItemType Directory -Path $buildOutputPath | Out-Null

Write-Host "Building frontend..."
Push-Location $frontendPath
npm install
npm run build
Pop-Location

Write-Host "Copying frontend to backend/static..."
if (Test-Path $staticTargetPath) {
    Remove-Item $staticTargetPath -Recurse -Force
}
New-Item -ItemType Directory -Path $staticTargetPath | Out-Null
Copy-Item -Path "$frontendDistPath\*" -Destination $staticTargetPath -Recurse -Force

Write-Host "Building Rust backend in release mode..."
Push-Location $backendPath
cargo build --release
Pop-Location

Write-Host "Preparing final build output..."
$compiledBinaryPath = Join-Path $backendPath "target/release/$binaryName"
Copy-Item -Path $compiledBinaryPath -Destination (Join-Path $buildOutputPath $binaryName) -Force

Copy-Item -Path $staticTargetPath -Destination (Join-Path $buildOutputPath "static") -Recurse

Write-Host "Creating zip archive..."
if (Test-Path $zipOutput) {
    Remove-Item $zipOutput -Force
}
Compress-Archive -Path "$buildOutputPath/*" -DestinationPath $zipOutput

Write-Host "Build complete. Output is in /build and packaged as $zipOutput"
