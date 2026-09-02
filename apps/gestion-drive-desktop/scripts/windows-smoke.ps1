param(
  [Parameter(Mandatory = $true)][string]$InstallerPath,
  [Parameter(Mandatory = $true)][ValidateSet('msi', 'nsis')][string]$InstallerType,
  [Parameter(Mandatory = $true)][string]$ExpectedVersion,
  [string]$EvidenceDir = "$PSScriptRoot/../smoke-artifacts"
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $EvidenceDir | Out-Null
$startedAt = Get-Date
$productCode = $null
$app = $null

function Get-UninstallEntry {
  $roots = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  Get-ItemProperty $roots -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like 'Gestion Drive*' } |
    Sort-Object InstallDate -Descending |
    Select-Object -First 1
}

function Resolve-InstalledExecutable($entry) {
  $candidates = @()
  if ($entry.InstallLocation) {
    $installLocation = $entry.InstallLocation.Trim().Trim('"')
    $candidates += Join-Path $installLocation 'gestion-drive-desktop.exe'
  }
  if ($entry.DisplayIcon) {
    $candidates += (($entry.DisplayIcon -replace '^"|"$','') -replace ',\d+$','')
  }
  $candidates += @(
    "$env:LOCALAPPDATA\Gestion Drive\gestion-drive-desktop.exe",
    "$env:ProgramFiles\Gestion Drive\gestion-drive-desktop.exe"
  )
  foreach ($candidate in $candidates | Select-Object -Unique) {
    if ($candidate -and (Test-Path $candidate)) { return (Resolve-Path $candidate).Path }
  }
  throw "Installed executable not found. InstallLocation=$($entry.InstallLocation) DisplayIcon=$($entry.DisplayIcon)"
}

try {
  $installer = (Resolve-Path $InstallerPath).Path
  if ($InstallerType -eq 'msi') {
    $wi = New-Object -ComObject WindowsInstaller.Installer
    $db = $wi.OpenDatabase($installer, 0)
    function Read-MsiProperty([string]$name) {
      $view = $db.OpenView("SELECT ``Value`` FROM ``Property`` WHERE ``Property``='$name'")
      $view.Execute()
      $record = $view.Fetch()
      if (-not $record) { throw "MSI property absent: $name" }
      $record.StringData(1)
    }
    $msiVersion = Read-MsiProperty 'ProductVersion'
    $productCode = Read-MsiProperty 'ProductCode'
    if ($msiVersion -ne $ExpectedVersion) {
      throw "MSI version $msiVersion does not match $ExpectedVersion"
    }
    if ((Get-Item $installer).Length -lt 50MB) {
      throw 'MSI is too small to contain the offline WebView2 installer'
    }
    $install = Start-Process msiexec.exe -Wait -PassThru -ArgumentList @(
      '/i', "`"$installer`"", '/qn', '/norestart', '/L*V', "`"$EvidenceDir\msi-install.log`""
    )
  } else {
    $install = Start-Process $installer -Wait -PassThru -ArgumentList '/S'
  }
  if ($install.ExitCode -ne 0) { throw "Installer exited with code $($install.ExitCode)" }

  $entry = $null
  $deadline = (Get-Date).AddSeconds(30)
  do {
    Start-Sleep -Seconds 2
    $entry = Get-UninstallEntry
  } until ($entry -or (Get-Date) -gt $deadline)
  if (-not $entry) { throw 'Gestion Drive uninstall registry entry not found' }
  if (-not $productCode) { $productCode = $entry.PSChildName }

  $exe = Resolve-InstalledExecutable $entry
  $fileVersion = (Get-Item $exe).VersionInfo.ProductVersion
  if ($fileVersion -notmatch [regex]::Escape($ExpectedVersion)) {
    throw "Installed EXE version $fileVersion does not match $ExpectedVersion"
  }

  $app = Start-Process $exe -PassThru
  $deadline = (Get-Date).AddSeconds(60)
  do {
    Start-Sleep -Seconds 2
    $app.Refresh()
  } until ($app.HasExited -or $app.MainWindowHandle -ne 0 -or (Get-Date) -gt $deadline)

  if ($app.HasExited) { throw "Application exited early with code $($app.ExitCode)" }
  if ($app.MainWindowHandle -eq 0) { throw 'No visible Gestion Desktop window after 60 seconds' }

  @{
    installerType = $InstallerType
    installer = $installer
    version = $fileVersion
    executable = $exe
    pid = $app.Id
    mainWindowHandle = $app.MainWindowHandle
    startedAt = $startedAt
  } | ConvertTo-Json | Set-Content "$EvidenceDir\launch-$InstallerType.json"
}
finally {
  if ($app -and -not $app.HasExited) {
    taskkill.exe /PID $app.Id /T /F | Out-Null
  }
  Get-WinEvent -FilterHashtable @{ LogName = 'Application'; StartTime = $startedAt } -ErrorAction SilentlyContinue |
    Where-Object { $_.ProviderName -in 'Application Error', 'Windows Error Reporting', '.NET Runtime' } |
    Format-List * | Out-File "$EvidenceDir\application-events-$InstallerType.txt"
  $logRoots = @(
    "$env:LOCALAPPDATA\com.marqueia.gestion-drive\logs",
    "$env:APPDATA\com.marqueia.gestion-drive\logs"
  )
  foreach ($root in $logRoots) {
    if (Test-Path $root) {
      Copy-Item $root "$EvidenceDir\app-logs-$InstallerType" -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}
