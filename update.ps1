param(
  [string]$RepositoryUrl = "https://gitee.com/zui216/jimeng-image-downloader",
  [string]$Branch = "main",
  [string]$DestinationPath = $PSScriptRoot,
  [string]$SuccessFlagPath = ""
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

function Get-SystemGitCommand {
  return Get-Command git -ErrorAction SilentlyContinue
}

function Get-BundledGitPath {
  param([string]$BasePath)

  return Join-Path $BasePath "tools\git\cmd\git.exe"
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

function Install-BundledGit {
  param(
    [string]$BasePath,
    [string]$TempRoot
  )

  $gitRoot = Join-Path $BasePath "tools\git"
  $zipPath = Join-Path $TempRoot "mingit.zip"
  $extractPath = Join-Path $TempRoot "mingit"
  $downloadUrl = Find-MinGitAssetUrl

  Write-Step "正在下载内置 Git：$downloadUrl"
  Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing

  Write-Step "正在安装内置 Git 到 $gitRoot"
  Remove-DirectorySafely -Path $gitRoot
  New-Item -ItemType Directory -Path $extractPath | Out-Null
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath -Force
  New-Item -ItemType Directory -Path (Split-Path -Parent $gitRoot) -Force | Out-Null
  New-Item -ItemType Directory -Path $gitRoot -Force | Out-Null
  Get-ChildItem -LiteralPath $extractPath -Force | ForEach-Object {
    Move-Item -LiteralPath $_.FullName -Destination $gitRoot -Force
  }

  $gitExe = Get-BundledGitPath -BasePath $BasePath
  if (-not (Test-Path -LiteralPath $gitExe)) {
    throw "内置 Git 安装完成后，仍未找到 git.exe。"
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

$resolvedDestination = Resolve-DestinationPath -Path $DestinationPath
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("jimeng-image-downloader-" + [System.Guid]::NewGuid().ToString("N"))
$clonePath = Join-Path $tempRoot "clone"

try {
  Write-Step "正在准备临时目录..."
  New-Item -ItemType Directory -Path $tempRoot | Out-Null
  $gitExe = Resolve-GitExecutable -BasePath $resolvedDestination -TempRoot $tempRoot

  Write-Step "正在使用 Git：$gitExe"
  Write-Step "正在从 $RepositoryUrl.git 拉取最新代码..."
  & $gitExe clone --depth 1 --branch $Branch ($RepositoryUrl + ".git") $clonePath
  if ($LASTEXITCODE -ne 0) {
    throw "git clone 执行失败。"
  }

  $sourceRoot = Get-Item -LiteralPath $clonePath

  Write-Step "正在复制文件到 $resolvedDestination"
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

  Write-Step "更新完成。"
  if (-not [string]::IsNullOrWhiteSpace($SuccessFlagPath)) {
    Set-Content -LiteralPath $SuccessFlagPath -Value "ok" -Encoding ASCII
  }
  exit 0
} catch {
  Write-Error $_
  exit 1
} finally {
  try {
    Remove-DirectorySafely -Path $tempRoot
  } catch {
    Write-Warning ("临时目录清理失败：" + $_.Exception.Message)
  }
}
