param(
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

function Resolve-DestinationPath {
  param([string]$Path)

  if ($null -eq $Path) {
    $cleanPath = ""
  } else {
    $cleanPath = $Path.Trim()
  }

  $cleanPath = $cleanPath.Trim('"')

  if ([string]::IsNullOrWhiteSpace($cleanPath)) {
    throw "目标路径为空。"
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

  throw "未找到 Git for Windows 最新版本中的 MinGit 64 位压缩包。"
}

$resolvedDestination = Resolve-DestinationPath -Path $DestinationPath
$gitRoot = Join-Path $resolvedDestination "tools\git"
$gitExe = Join-Path $gitRoot "cmd\git.exe"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("jimeng-image-downloader-git-" + [System.Guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $tempRoot "mingit.zip"
$extractPath = Join-Path $tempRoot "extract"

try {
  New-Item -ItemType Directory -Path $tempRoot | Out-Null
  New-Item -ItemType Directory -Path $extractPath | Out-Null

  $downloadUrl = Find-MinGitAssetUrl
  Write-Step "正在下载内置 Git：$downloadUrl"
  Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing

  Write-Step "正在安装内置 Git 到 $gitRoot"
  Remove-DirectorySafely -Path $gitRoot
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath -Force
  New-Item -ItemType Directory -Path (Split-Path -Parent $gitRoot) -Force | Out-Null
  New-Item -ItemType Directory -Path $gitRoot -Force | Out-Null
  Get-ChildItem -LiteralPath $extractPath -Force | ForEach-Object {
    Move-Item -LiteralPath $_.FullName -Destination $gitRoot -Force
  }

  if (-not (Test-Path -LiteralPath $gitExe)) {
    throw "内置 Git 安装完成后，仍未找到 git.exe。"
  }

  Write-Step "内置 Git 安装完成：$gitExe"
  [System.Environment]::Exit(0)
} catch {
  Write-Error $_
  [System.Environment]::Exit(1)
} finally {
  try {
    Remove-DirectorySafely -Path $tempRoot
  } catch {
    Write-Warning ("临时目录清理失败：" + $_.Exception.Message)
  }
}
