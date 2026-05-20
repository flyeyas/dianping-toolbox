param(
  [string]$RepositoryUrl = "https://gitee.com/zui216/jimeng-image-downloader",
  [string]$Branch = "main",
  [string]$DestinationPath = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[jimeng-image-downloader] $Message"
}

function Remove-DirectorySafely {
  param([string]$Path)

  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
}

$resolvedDestination = [System.IO.Path]::GetFullPath($DestinationPath)
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("jimeng-image-downloader-" + [System.Guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $tempRoot "package.zip"
$extractPath = Join-Path $tempRoot "extract"
$downloadUrl = "$RepositoryUrl/repository/archive/$Branch.zip"

try {
  Write-Step "Preparing temporary workspace..."
  New-Item -ItemType Directory -Path $tempRoot | Out-Null
  New-Item -ItemType Directory -Path $extractPath | Out-Null

  Write-Step "Downloading latest package from $downloadUrl"
  Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing

  Write-Step "Extracting package..."
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath -Force

  $sourceRoot = Get-ChildItem -LiteralPath $extractPath -Directory | Select-Object -First 1
  if (-not $sourceRoot) {
    throw "No extracted source directory was found."
  }

  Write-Step "Copying files into $resolvedDestination"
  Get-ChildItem -LiteralPath $sourceRoot.FullName -Force | ForEach-Object {
    if ($_.Name -eq ".git") {
      return
    }

    $targetPath = Join-Path $resolvedDestination $_.Name

    if ($_.PSIsContainer) {
      Remove-DirectorySafely -Path $targetPath
      Copy-Item -LiteralPath $_.FullName -Destination $targetPath -Recurse -Force
      return
    }

    Copy-Item -LiteralPath $_.FullName -Destination $targetPath -Force
  }

  Write-Step "Update completed."
  exit 0
} catch {
  Write-Error $_
  exit 1
} finally {
  Remove-DirectorySafely -Path $tempRoot
}
