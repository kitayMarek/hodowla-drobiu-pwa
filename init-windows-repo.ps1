param(
  [string]$ProjectPath = "C:\Moje\Cloude\Zarzadzanie Gospodarstwem",
  [string]$RepoName = "zarzadzanie-gospodarstwem",
  [string]$GithubOwner = "",
  [switch]$CreateGithubRepo,
  [switch]$MigrateCurrentRepo,
  [string]$MigratePath = ""
)

$ghAvailable = Get-Command gh -ErrorAction SilentlyContinue
if (($CreateGithubRepo -or $MigrateCurrentRepo -or $MigratePath -ne "") -and (-not $ghAvailable)) {
  throw "Nie znaleziono GitHub CLI ('gh'). Zainstaluj: https://cli.github.com/"
}

if ($MigrateCurrentRepo -or $MigratePath -ne "") {
  if ($MigratePath -ne "") {
    if (-not (Test-Path -LiteralPath $MigratePath)) {
      throw "Ścieżka do migracji nie istnieje: $MigratePath"
    }
    Set-Location -LiteralPath $MigratePath
  }

  $repoRoot = git rev-parse --show-toplevel 2>$null
  if ($LASTEXITCODE -ne 0 -or $repoRoot -eq "") {
    throw "Wskazany katalog nie jest repozytorium git."
  }

  Set-Location -LiteralPath $repoRoot

  if ($GithubOwner -eq "") {
    $GithubOwner = gh api user --jq .login
  }

  $repoSlug = "$GithubOwner/$RepoName"

  gh repo view $repoSlug 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) {
    gh repo create $repoSlug --private --source . --remote origin --push
  } else {
    $remoteUrl = "https://github.com/$repoSlug.git"
    $remoteExists = git remote | Select-String -Pattern "^origin$"

    if (-not $remoteExists) {
      git remote add origin $remoteUrl
    } else {
      git remote set-url origin $remoteUrl
    }

    git push -u origin --all
    git push -u origin --tags
  }

  Write-Host "Repozytorium zostało przeniesione na GitHub: https://github.com/$repoSlug"
  exit 0
}

if (-not (Test-Path -LiteralPath $ProjectPath)) {
  New-Item -ItemType Directory -Path $ProjectPath -Force | Out-Null
}

Set-Location -LiteralPath $ProjectPath

if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath ".git"))) {
  git init
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath ".gitignore"))) {
  @"
node_modules/
dist/
.env
.DS_Store
"@ | Set-Content -LiteralPath (Join-Path $ProjectPath ".gitignore") -Encoding UTF8
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath "README.md"))) {
  "# Zarzadzanie Gospodarstwem" | Set-Content -LiteralPath (Join-Path $ProjectPath "README.md") -Encoding UTF8
}

git add .
git commit -m "Initial commit" 2>$null

$currentBranch = git branch --show-current
if ($currentBranch -eq "") {
  $currentBranch = "main"
  git branch -M $currentBranch
}

if ($CreateGithubRepo) {
  if ($GithubOwner -eq "") {
    $GithubOwner = gh api user --jq .login
  }

  $repoSlug = "$GithubOwner/$RepoName"

  gh repo view $repoSlug 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) {
    gh repo create $repoSlug --private --source . --remote origin --push
  } else {
    $remoteUrl = "https://github.com/$repoSlug.git"
    $remoteExists = git remote | Select-String -Pattern "^origin$"

    if (-not $remoteExists) {
      git remote add origin $remoteUrl
    } else {
      git remote set-url origin $remoteUrl
    }

    git push -u origin $currentBranch
  }

  Write-Host "Repozytorium GitHub gotowe: https://github.com/$repoSlug"
} else {
  Write-Host "Repo lokalne gotowe w: $ProjectPath"
  Write-Host "Aby utworzyć repo na GitHub, uruchom skrypt z flagą -CreateGithubRepo"
}
