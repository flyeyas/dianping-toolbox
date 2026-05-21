param(
  [string]$RepositoryUrl = "https://gitee.com/zui216/jimeng-image-downloader.git",
  [string]$RemoteName = "gitee",
  [string]$Branch = "main",
  [string]$DestinationPath = $PSScriptRoot,
  [string]$SuccessFlagPath = ""
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-Step {
  param([string]$Message)
  Write-Host "[jimeng-image-downloader] $Message"
}

function Remove-PathSafely {
  param([string]$Path)

  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
}

function Get-SystemGitCommand {
  return Get-Command git -ErrorAction SilentlyContinue
}

function Get-BundledGitPath {
  param([string]$BasePath)

  return Join-Path $BasePath "tools\git\cmd\git.exe"
}

function Resolve-DestinationPath {
  param([string]$Path)

  if ($null -eq $Path) {
    $cleanPath = ""
  } else {
    $cleanPath = $Path.Trim()
  }

  $cleanPath = $cleanPath.Trim('"')

  if ([string]::IsNullOrWhiteSpace($cleanPath)) {
    throw "The destination path is empty."
  }

  while ($cleanPath.Length -gt 3 -and ($cleanPath.EndsWith("\") -or $cleanPath.EndsWith("/"))) {
    $cleanPath = $cleanPath.Substring(0, $cleanPath.Length - 1)
  }

  if ($cleanPath.Length -eq 2 -and $cleanPath[1] -eq ':') {
    $cleanPath += '\'
  }

  return [System.IO.Path]::GetFullPath($cleanPath)
}

function Find-MinGitAssetUrl {
  $releaseApi = "https://api.github.com/repos/git-for-windows/git/releases/latest"
  $headers = @{
    "User-Agent" = "jimeng-image-downloader-updater"
  }

  $release = Invoke-RestMethod -Uri $releaseApi -Headers $headers
  foreach ($asset in $release.assets) {
    if ($asset.name -match '^MinGit-.*-64-bit\.zip$') {
      return $asset.browser_download_url
    }
  }

  throw "Could not find the latest MinGit 64-bit zip from Git for Windows."
}

function Install-BundledGit {
  param(
    [string]$BasePath,
    [string]$TempRoot
  )

  $gitRoot = Join-Path $BasePath "tools\git"
  $zipPath = Join-Path $TempRoot "mingit.zip"
  $extractPath = Join-Path $TempRoot "mingit"
  $downloadUrl = Find-MinGitAssetUrl

  Write-Step "Downloading portable Git..."
  Write-Step $downloadUrl
  Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing

  Write-Step "Installing portable Git..."
  Remove-PathSafely -Path $gitRoot
  New-Item -ItemType Directory -Path $extractPath | Out-Null
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath -Force
  New-Item -ItemType Directory -Path (Split-Path -Parent $gitRoot) -Force | Out-Null
  New-Item -ItemType Directory -Path $gitRoot -Force | Out-Null
  Get-ChildItem -LiteralPath $extractPath -Force | ForEach-Object {
    Move-Item -LiteralPath $_.FullName -Destination $gitRoot -Force
  }

  $gitExe = Get-BundledGitPath -BasePath $BasePath
  if (-not (Test-Path -LiteralPath $gitExe)) {
    throw "git.exe was not found after portable Git installation."
  }

  return $gitExe
}

function Resolve-GitExecutable {
  param(
    [string]$BasePath,
    [string]$TempRoot
  )

  $bundledGit = Get-BundledGitPath -BasePath $BasePath
  if (Test-Path -LiteralPath $bundledGit) {
    return $bundledGit
  }

  $systemGit = Get-SystemGitCommand
  if ($null -ne $systemGit) {
    return $systemGit.Source
  }

  return Install-BundledGit -BasePath $BasePath -TempRoot $TempRoot
}

$resolvedDestination = Resolve-DestinationPath -Path $DestinationPath
$manifestPath = Join-Path $resolvedDestination "manifest.json"
$gitDirPath = Join-Path $resolvedDestination ".git"

if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "manifest.json was not found in the current folder. Put update.bat in the extension root folder and run it again."
}

if (-not (Test-Path -LiteralPath $gitDirPath)) {
  throw ".git was not found in the current folder. This updater only works with a package that already includes the Git repository."
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("jimeng-image-downloader-" + [System.Guid]::NewGuid().ToString("N"))

try {
  Write-Step "Preparing temporary folder..."
  New-Item -ItemType Directory -Path $tempRoot | Out-Null
  $gitExe = Resolve-GitExecutable -BasePath $resolvedDestination -TempRoot $tempRoot

  Write-Step "Using Git: $gitExe"
  Write-Step "Checking repository state..."
  & $gitExe -C $resolvedDestination rev-parse --is-inside-work-tree
  if ($LASTEXITCODE -ne 0) {
    throw "The current folder is not a valid Git repository."
  }

  Write-Step "Configuring remote..."
  & $gitExe -C $resolvedDestination remote > $null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to read Git remotes."
  }

  $remoteList = (& $gitExe -C $resolvedDestination remote) | ForEach-Object { $_.Trim() } | Where-Object { $_ }
  if ($remoteList -notcontains $RemoteName) {
    & $gitExe -C $resolvedDestination remote add $RemoteName $RepositoryUrl
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to create remote $RemoteName."
    }
  }

  & $gitExe -C $resolvedDestination remote set-url $RemoteName $RepositoryUrl
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to set remote $RemoteName to the HTTPS URL."
  }

  Write-Step "Pulling latest version..."
  & $gitExe -C $resolvedDestination pull --ff-only $RemoteName $Branch
  if ($LASTEXITCODE -ne 0) {
    throw "git pull failed."
  }

  Write-Step "Cleaning removed files..."
  & $gitExe -C $resolvedDestination clean -fd
  if ($LASTEXITCODE -ne 0) {
    throw "git clean failed."
  }

  Write-Step "Update complete."
  if (-not [string]::IsNullOrWhiteSpace($SuccessFlagPath)) {
    Set-Content -LiteralPath $SuccessFlagPath -Value "ok" -Encoding ASCII
  }
  exit 0
} catch {
  Write-Error $_
  Write-Host ""
  Write-Host "If the network request failed, make sure this PC can access Gitee."
  Write-Host "If a file is locked, close the Chrome extension details page and run update.bat again."
  Write-Host "Any manual changes inside the extension folder will be overwritten by this update."
  exit 1
} finally {
  try {
    Remove-PathSafely -Path $tempRoot
  } catch {
    Write-Warning ("Failed to clean temporary folder: " + $_.Exception.Message)
  }
}
