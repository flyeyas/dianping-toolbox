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

function Get-RepositoryWebUrl {
  param([string]$Url)

  if ($Url.EndsWith(".git")) {
    return $Url.Substring(0, $Url.Length - 4)
  }

  return $Url
}

function Get-ArchiveDownloadUrl {
  param(
    [string]$Url,
    [string]$BranchName
  )

  $repositoryWebUrl = Get-RepositoryWebUrl -Url $Url
  return "$repositoryWebUrl/repository/archive/$BranchName.zip"
}

function Get-AvailableGitExecutable {
  param([string]$BasePath)

  $bundledGit = Get-BundledGitPath -BasePath $BasePath
  if (Test-Path -LiteralPath $bundledGit) {
    return $bundledGit
  }

  $systemGit = Get-SystemGitCommand
  if ($null -ne $systemGit) {
    return $systemGit.Source
  }

  return $null
}

function Copy-DirectoryContents {
  param(
    [string]$SourcePath,
    [string]$DestinationPath
  )

  Get-ChildItem -LiteralPath $SourcePath -Force | ForEach-Object {
    $targetPath = Join-Path $DestinationPath $_.Name

    if ($_.PSIsContainer) {
      Copy-Item -LiteralPath $_.FullName -Destination $targetPath -Recurse -Force
      return
    }

    Copy-Item -LiteralPath $_.FullName -Destination $targetPath -Force
  }
}

function Update-FromArchive {
  param(
    [string]$Url,
    [string]$BranchName,
    [string]$DestinationRoot,
    [string]$TempRoot
  )

  $archiveUrl = Get-ArchiveDownloadUrl -Url $Url -BranchName $BranchName
  $archivePath = Join-Path $TempRoot "repo.zip"
  $extractPath = Join-Path $TempRoot "archive"

  Write-Step "未检测到可用的 Git，改为直接下载压缩包更新..."
  Write-Step "正在下载更新压缩包..."
  Write-Step $archiveUrl
  Invoke-WebRequest -Uri $archiveUrl -OutFile $archivePath -UseBasicParsing

  Write-Step "正在解压更新文件..."
  New-Item -ItemType Directory -Path $extractPath | Out-Null
  Expand-Archive -LiteralPath $archivePath -DestinationPath $extractPath -Force

  $manifestFile = Get-ChildItem -LiteralPath $extractPath -Recurse -File -Filter "manifest.json" | Select-Object -First 1
  if ($null -eq $manifestFile) {
    throw "压缩包中没有找到 manifest.json，无法确认插件目录。"
  }

  $sourceRoot = Split-Path -Parent $manifestFile.FullName

  Write-Step "正在清理旧文件..."
  Get-ChildItem -LiteralPath $DestinationRoot -Force | Where-Object { $_.Name -ne ".git" } | ForEach-Object {
    Remove-PathSafely -Path $_.FullName
  }

  Write-Step "正在复制新文件..."
  Copy-DirectoryContents -SourcePath $sourceRoot -DestinationPath $DestinationRoot
}

$resolvedDestination = Resolve-DestinationPath -Path $DestinationPath
$manifestPath = Join-Path $resolvedDestination "manifest.json"
$gitDirPath = Join-Path $resolvedDestination ".git"

if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "没有在当前目录找到 manifest.json。请把 update.bat 放在插件根目录后再运行。"
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("jimeng-image-downloader-" + [System.Guid]::NewGuid().ToString("N"))

try {
  Write-Step "正在准备临时目录..."
  New-Item -ItemType Directory -Path $tempRoot | Out-Null

  $gitExe = Get-AvailableGitExecutable -BasePath $resolvedDestination
  $canUseGitUpdate = ($null -ne $gitExe) -and (Test-Path -LiteralPath $gitDirPath)

  if ($canUseGitUpdate) {
    Write-Step "正在使用 Git：$gitExe"
    Write-Step "正在检查仓库状态..."
    & $gitExe -C $resolvedDestination rev-parse --is-inside-work-tree
    if ($LASTEXITCODE -ne 0) {
      throw "当前目录不是有效的 Git 仓库。"
    }

    Write-Step "正在设置更新源..."
    & $gitExe -C $resolvedDestination remote > $null
    if ($LASTEXITCODE -ne 0) {
      throw "无法读取 Git 远端配置。"
    }

    $remoteList = (& $gitExe -C $resolvedDestination remote) | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    if ($remoteList -notcontains $RemoteName) {
      & $gitExe -C $resolvedDestination remote add $RemoteName $RepositoryUrl
      if ($LASTEXITCODE -ne 0) {
        throw "无法创建远端 $RemoteName。"
      }
    }

    & $gitExe -C $resolvedDestination remote set-url $RemoteName $RepositoryUrl
    if ($LASTEXITCODE -ne 0) {
      throw "无法把远端 $RemoteName 设置为 HTTPS 地址。"
    }

    Write-Step "正在拉取最新版本..."
    & $gitExe -C $resolvedDestination pull --ff-only $RemoteName $Branch
    if ($LASTEXITCODE -ne 0) {
      throw "git pull 执行失败。"
    }

    Write-Step "正在清理已删除的旧文件..."
    & $gitExe -C $resolvedDestination clean -fd
    if ($LASTEXITCODE -ne 0) {
      throw "git clean 执行失败。"
    }
  } else {
    Update-FromArchive -Url $RepositoryUrl -BranchName $Branch -DestinationRoot $resolvedDestination -TempRoot $tempRoot
  }

  Write-Step "更新完成。"
  Write-Host ""
  Write-Host "更新完成。请回到 Chrome 扩展页面点一次“重新加载”。"
  if (-not [string]::IsNullOrWhiteSpace($SuccessFlagPath)) {
    Set-Content -LiteralPath $SuccessFlagPath -Value "ok" -Encoding ASCII
  }
  exit 0
} catch {
  Write-Error $_
  Write-Host ""
  Write-Host "如果提示网络失败，请确认电脑可以访问 Gitee。"
  Write-Host "如果提示文件被占用，请先关闭 Chrome 里的扩展详情页，再重新运行 update.bat。"
  Write-Host "如果你手动修改过插件目录里的文件，这次更新会把这些改动覆盖掉。"
  exit 1
} finally {
  try {
    Remove-PathSafely -Path $tempRoot
  } catch {
    Write-Warning ("临时目录清理失败：" + $_.Exception.Message)
  }
}
