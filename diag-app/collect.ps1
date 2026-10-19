# PC2 Diag : collecte des informations du poste, écrites en JSON dans $Out.
# Chaque étape écrit « n|total|libellé » dans $Progress pour la barre de progression.
param([Parameter(Mandatory = $true)][string]$Out, [string]$Progress)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = New-Object Text.UTF8Encoding($false) } catch {}

$t0 = Get-Date
$since = $t0.AddDays(-30)
$R = [ordered]@{}
$script:errs = @()
$script:step = 0
$total = 13

function Step($label) {
  $script:step++
  $line = "{0}|{1}|{2}" -f $script:step, $total, $label
  if ($Progress) { try { [IO.File]::WriteAllText($Progress, $line, (New-Object Text.UTF8Encoding($false))) } catch {} }
  Write-Output ("##STEP|" + $line)
}
function Try-Get($name, [scriptblock]$sb, $default = $null) {
  try { & $sb } catch { $script:errs += [ordered]@{ check = $name; msg = $_.Exception.Message }; $default }
}
function D($d) { if ($d) { try { ([datetime]$d).ToString('yyyy-MM-ddTHH:mm:ss') } catch { $null } } else { $null } }
function GB($b) { if ($b) { [math]::Round([double]$b / 1GB, 1) } else { 0 } }
function Short($t, $n) { $t = (($t -as [string]) -replace '\s+', ' ').Trim(); if ($t.Length -gt $n) { $t.Substring(0, $n) } else { $t } }
function Ev($log, $ids, $provider) {
  $f = @{ LogName = $log; StartTime = $since }
  if ($ids) { $f.Id = $ids }
  if ($provider) { $f.ProviderName = $provider }
  try { @(Get-WinEvent -FilterHashtable $f -ErrorAction Stop) } catch { @() }
}
function Reg($path, $name) { try { (Get-ItemProperty -Path $path -Name $name -ErrorAction Stop).$name } catch { $null } }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

# ------------------------------------------------------------------ Système
Step 'Système et carte mère'
$os = Get-CimInstance Win32_OperatingSystem
$cs = Get-CimInstance Win32_ComputerSystem
$bios = Try-Get 'bios' { Get-CimInstance Win32_BIOS }
$bb = Try-Get 'baseboard' { Get-CimInstance Win32_BaseBoard }
$csp = Try-Get 'csproduct' { Get-CimInstance Win32_ComputerSystemProduct }
$cv = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$R.meta = [ordered]@{
  computer = $env:COMPUTERNAME
  user = "$env:USERDOMAIN\$env:USERNAME"
  isAdmin = $isAdmin
  os = $os.Caption
  edition = (Reg $cv 'EditionID')
  displayVersion = (Reg $cv 'DisplayVersion')
  build = [int]$os.BuildNumber
  ubr = (Reg $cv 'UBR')
  arch = $os.OSArchitecture
  installDate = (D $os.InstallDate)
  lastBoot = (D $os.LastBootUpTime)
  uptimeDays = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalDays, 1)
  manufacturer = $cs.Manufacturer
  model = $cs.Model
  family = $cs.SystemFamily
  productName = $csp.Version
  serial = $bios.SerialNumber
  board = (($bb.Manufacturer, $bb.Product) -join ' ').Trim()
  bios = $bios.SMBIOSBIOSVersion
  biosDate = (D $bios.ReleaseDate)
  domain = $cs.Domain
  partOfDomain = $cs.PartOfDomain
  scanDate = (D (Get-Date))
}

# ------------------------------------------------------------------ CPU / RAM / GPU
Step 'Processeur, mémoire et carte graphique'
$cpu = @(Get-CimInstance Win32_Processor)
$R.cpu = [ordered]@{
  name = (($cpu[0].Name -as [string]) -replace '\s+', ' ').Trim()
  cores = ($cpu | Measure-Object NumberOfCores -Sum).Sum
  threads = ($cpu | Measure-Object NumberOfLogicalProcessors -Sum).Sum
  maxMHz = $cpu[0].MaxClockSpeed
  load = (Try-Get 'cpuload' { [math]::Round(($cpu | Measure-Object LoadPercentage -Average).Average, 0) })
  virt = $cpu[0].VirtualizationFirmwareEnabled
}
$R.mem = [ordered]@{
  totalGB = (GB $cs.TotalPhysicalMemory)
  freeGB = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
  usedPct = [math]::Round(100 - ($os.FreePhysicalMemory / $os.TotalVisibleMemorySize * 100), 0)
  modules = @(Try-Get 'dimm' { Get-CimInstance Win32_PhysicalMemory | ForEach-Object {
    [ordered]@{ slot = $_.DeviceLocator; sizeGB = (GB $_.Capacity); speed = $_.Speed
      maker = (($_.Manufacturer -as [string]) + '').Trim(); part = (($_.PartNumber -as [string]) + '').Trim() } } } @())
  slots = (Try-Get 'memslots' { (Get-CimInstance Win32_PhysicalMemoryArray | Measure-Object MemoryDevices -Sum).Sum })
}
$R.gpu = @(Try-Get 'gpu' { Get-CimInstance Win32_VideoController | ForEach-Object {
  [ordered]@{ name = $_.Name; driver = $_.DriverVersion; driverDate = (D $_.DriverDate); status = $_.Status } } } @())
$R.thermal = @(Try-Get 'thermal' { Get-CimInstance -Namespace root\wmi MSAcpi_ThermalZoneTemperature -ErrorAction Stop | ForEach-Object {
  [ordered]@{ zone = ($_.InstanceName -split '\\')[-1]; c = [math]::Round($_.CurrentTemperature / 10 - 273.15, 0) } } } @())
$R.topProcesses = @(Try-Get 'procs' { Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 8 | ForEach-Object {
  [ordered]@{ name = $_.ProcessName; ramMB = [math]::Round($_.WorkingSet64 / 1MB, 0) } } } @())

# ------------------------------------------------------------------ Disques
Step 'Disques et état SMART'
$R.disks = @(Try-Get 'physicaldisk' { Get-PhysicalDisk | ForEach-Object {
  $pd = $_; $rc = $null
  try { $rc = $pd | Get-StorageReliabilityCounter -ErrorAction Stop } catch {}
  [ordered]@{
    name = $pd.FriendlyName; serial = (($pd.SerialNumber -as [string]) + '').Trim()
    media = [string]$pd.MediaType; bus = [string]$pd.BusType; sizeGB = (GB $pd.Size)
    health = [string]$pd.HealthStatus; firmware = $pd.FirmwareVersion
    wear = $(if ($rc) { $rc.Wear } else { $null })
    temp = $(if ($rc) { $rc.Temperature } else { $null })
    hours = $(if ($rc) { $rc.PowerOnHours } else { $null })
    readErr = $(if ($rc) { $rc.ReadErrorsUncorrected } else { $null })
    writeErr = $(if ($rc) { $rc.WriteErrorsUncorrected } else { $null })
  } } } @())
$R.smartPredict = @(Try-Get 'smartpredict' { Get-CimInstance -Namespace root\wmi MSStorageDriver_FailurePredictStatus -ErrorAction Stop | Where-Object { $_.PredictFailure } | ForEach-Object { $_.InstanceName } } @())

Step 'Volumes, espace libre et BitLocker'
$bl = @{}
Try-Get 'bitlocker' { Get-BitLockerVolume -ErrorAction Stop | ForEach-Object { $bl[$_.MountPoint.TrimEnd('\')] = [string]$_.ProtectionStatus } } | Out-Null
$R.volumes = @(Try-Get 'volumes' { Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
  $dirty = $null
  if ($isAdmin) {
    try { $q = (& fsutil dirty query $_.DeviceID 2>$null) -join ' '; if ($q) { $dirty = ($q -notmatch 'NOT|PAS|n.est pas') } } catch {}
  }
  [ordered]@{ letter = $_.DeviceID; label = $_.VolumeName; fs = $_.FileSystem; sizeGB = (GB $_.Size); freeGB = (GB $_.FreeSpace)
    freePct = $(if ($_.Size) { [math]::Round($_.FreeSpace / $_.Size * 100, 0) } else { $null }); dirty = $dirty; bitlocker = $bl[$_.DeviceID] } } } @())
$tempPaths = @($env:TEMP, "$env:windir\Temp", "$env:windir\SoftwareDistribution\Download")
$R.junkGB = (Try-Get 'temp' { GB (($tempPaths | ForEach-Object { Get-ChildItem $_ -Recurse -Force -File -ErrorAction SilentlyContinue } | Measure-Object Length -Sum).Sum) } 0)

# ------------------------------------------------------------------ Batterie
Step 'Batterie'
function Get-BatteryReport {
  try {
    $p = Join-Path $env:TEMP 'pc2diag_battery.xml'
    & powercfg /batteryreport /output $p /xml 2>$null | Out-Null
    if (-not (Test-Path $p)) { return $null }
    [xml]$x = Get-Content $p -Raw -ErrorAction Stop
    Remove-Item $p -ErrorAction SilentlyContinue
    $design = 0; $full = 0; $cyc = 0
    foreach ($node in $x.SelectNodes('//*')) {
      switch ($node.LocalName) {
        'DesignCapacity' { if ($node.'#text') { $design += [double]$node.'#text' } }
        'FullChargeCapacity' { if ($node.'#text') { $full += [double]$node.'#text' } }
        'CycleCount' { if ($node.'#text') { $cyc += [int]$node.'#text' } }
      }
    }
    if (-not $design) { return $null }
    return @{ design = [int]$design; full = [int]$full; cycles = $(if ($cyc -gt 0) { $cyc } else { $null }) }
  } catch { return $null }
}
$R.battery = Try-Get 'battery' {
  $b = @(Get-CimInstance Win32_Battery)
  if ($b.Count -eq 0) { return [ordered]@{ present = $false } }
  $design = (Get-CimInstance -Namespace root\wmi BatteryStaticData -ErrorAction SilentlyContinue | Select-Object -First 1).DesignedCapacity
  $full = (Get-CimInstance -Namespace root\wmi BatteryFullChargedCapacity -ErrorAction SilentlyContinue | Select-Object -First 1).FullChargedCapacity
  $cyc = (Get-CimInstance -Namespace root\wmi BatteryCycleCount -ErrorAction SilentlyContinue | Select-Object -First 1).CycleCount
  $src = 'WMI'
  if (-not $design -or -not $full) {
    $rep = Get-BatteryReport
    if ($rep) {
      if (-not $design) { $design = $rep.design; $src = 'powercfg' }
      if (-not $full) { $full = $rep.full; $src = 'powercfg' }
      if (-not $cyc) { $cyc = $rep.cycles }
    }
  }
  [ordered]@{
    present = $true; name = $b[0].Name; charge = $b[0].EstimatedChargeRemaining
    design = $design; full = $full; cycles = $cyc; source = $src
    wearPct = $(if ($design -and $full) { [math]::Round((1 - $full / $design) * 100, 1) } else { $null })
  }
} ([ordered]@{ present = $false })

# ------------------------------------------------------------------ Périphériques et réseau
Step 'Périphériques et pilotes'
$R.devices = @(Try-Get 'pnp' { Get-CimInstance Win32_PnPEntity -Filter 'ConfigManagerErrorCode<>0' | Where-Object { $_.ConfigManagerErrorCode -ne 45 } | ForEach-Object {
  [ordered]@{ name = $(if ($_.Name) { $_.Name } else { $_.DeviceID }); cls = $_.PNPClass; code = $_.ConfigManagerErrorCode } } } @())
$R.network = [ordered]@{}
$R.network.adapters = @(Try-Get 'netadapters' { Get-NetAdapter -Physical -ErrorAction Stop | ForEach-Object {
  [ordered]@{ name = $_.Name; desc = $_.InterfaceDescription; status = [string]$_.Status; speed = $_.LinkSpeed; mac = $_.MacAddress } } } @())

# ------------------------------------------------------------------ Stabilité
Step "Journaux d'événements (30 derniers jours)"
$ev = [ordered]@{}
$ev.kernelPower41 = @(Ev 'System' 41 'Microsoft-Windows-Kernel-Power').Count
$ev.unexpected6008 = @(Ev 'System' 6008 'EventLog').Count
$bs = Ev 'System' 1001 'Microsoft-Windows-WER-SystemErrorReporting'
if ($bs.Count -eq 0) { $bs = Ev 'System' 1001 'BugCheck' }
$ev.bsod = @($bs | Select-Object -First 10 | ForEach-Object {
  [ordered]@{ date = (D $_.TimeCreated); code = $(try { [string]$_.Properties[0].Value } catch { '' }); msg = (Short $_.Message 220) } })
$wh = Ev 'System' $null 'Microsoft-Windows-WHEA-Logger'
$ev.whea = $wh.Count
$ev.wheaSample = @($wh | Select-Object -First 3 | ForEach-Object { Short $_.Message 200 })
$ev.disk = @(Ev 'System' @(7, 11, 51, 153) 'disk').Count
$ev.ntfs = @(Ev 'System' @(55, 98, 137) 'Ntfs').Count
$ev.storReset = @(Ev 'System' 129 $null | Where-Object { $_.ProviderName -match 'stor|nvme|iaStor' }).Count
$ac = Ev 'Application' 1000 'Application Error'
$ev.appCrashTotal = $ac.Count
$ev.appCrashes = @($ac | ForEach-Object { try { [string]$_.Properties[0].Value } catch { '?' } } | Group-Object | Sort-Object Count -Descending | Select-Object -First 8 | ForEach-Object { [ordered]@{ app = $_.Name; count = $_.Count } })
$ev.dumps = Try-Get 'dumps' { $f = @(Get-ChildItem "$env:windir\Minidump" -Filter *.dmp -ErrorAction SilentlyContinue); [ordered]@{ count = $f.Count; last = (D ($f | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime) } } ([ordered]@{ count = 0 })
$R.events = $ev
$R.reliability = Try-Get 'reliability' { $m = Get-CimInstance Win32_ReliabilityStabilityMetrics -ErrorAction Stop | Sort-Object TimeGenerated -Descending | Select-Object -First 1; if ($m) { [math]::Round($m.SystemStabilityIndex, 1) } else { $null } }

# ------------------------------------------------------------------ Windows Update
Step 'Windows Update'
$up = [ordered]@{}
Try-Get 'wuhistory' {
  $s = New-Object -ComObject Microsoft.Update.Session
  $h = $s.CreateUpdateSearcher(); $n = $h.GetTotalHistoryCount()
  if ($n -gt 0) {
    $hist = @($h.QueryHistory(0, [math]::Min(100, $n)))
    $ok = $hist | Where-Object { $_.ResultCode -eq 2 } | Sort-Object Date -Descending | Select-Object -First 1
    if ($ok) { $up.lastSuccess = (D $ok.Date); $up.lastTitle = $ok.Title }
    $up.failed = @($hist | Where-Object { ($_.ResultCode -in @(4, 5)) -and ($_.Date -gt $since) } | Select-Object -First 5 | ForEach-Object { [ordered]@{ date = (D $_.Date); title = $_.Title } })
  }
} | Out-Null
$up.rebootPending = (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending') -or (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired')
$up.wuService = Try-Get 'wusvc' { [string](Get-Service wuauserv -ErrorAction Stop).StartType }
$R.updates = $up

# ------------------------------------------------------------------ Sécurité
Step 'Sécurité (antivirus, pare-feu, comptes)'
$sec = [ordered]@{}
$sec.defender = Try-Get 'defender' { $m = Get-MpComputerStatus -ErrorAction Stop; [ordered]@{ av = $m.AntivirusEnabled; rtp = $m.RealTimeProtectionEnabled; sigAge = $m.AntivirusSignatureAge; mode = [string]$m.AMRunningMode } }
$sec.av = @(Try-Get 'securitycenter' { Get-CimInstance -Namespace root\SecurityCenter2 AntiVirusProduct -ErrorAction Stop | ForEach-Object {
  $st = [int]$_.productState; [ordered]@{ name = $_.displayName; enabled = (($st -band 0x1000) -ne 0); upToDate = (($st -band 0x10) -eq 0) } } } @())
$sec.firewall = @(Try-Get 'firewall' { Get-NetFirewallProfile -ErrorAction Stop | ForEach-Object { [ordered]@{ profile = [string]$_.Name; enabled = [bool]$_.Enabled } } } @())
$sec.secureBoot = Try-Get 'secureboot' { Confirm-SecureBootUEFI -ErrorAction Stop }
$sec.tpm = Try-Get 'tpm' { $t = Get-Tpm -ErrorAction Stop; [ordered]@{ present = $t.TpmPresent; ready = $t.TpmReady } }
$sec.uac = Reg 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' 'EnableLUA'
$sec.smb1 = Try-Get 'smb1' { (Get-SmbServerConfiguration -ErrorAction Stop).EnableSMB1Protocol }
$sec.rdp = ((Reg 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server' 'fDenyTSConnections') -eq 0)
$sec.rdpNla = ((Reg 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' 'UserAuthentication') -eq 1)
$sec.autologon = ((Reg 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' 'AutoAdminLogon') -eq '1')
$sec.autologonPwd = [bool](Reg 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' 'DefaultPassword')
$sec.admins = @(Try-Get 'admins' { Get-LocalGroupMember -SID 'S-1-5-32-544' -ErrorAction Stop | ForEach-Object { [string]$_.Name } } @())
$R.security = $sec

# ------------------------------------------------------------------ Logiciels
Step 'Services et démarrage'
$ignore = 'gupdate|gupdatem|edgeupdate|edgeupdatem|GoogleUpdater|MapsBroker|sppsvc|RemoteRegistry|TrustedInstaller|WbioSrvc|tiledatamodelsvc|DoSvc|UsoSvc|WaaSMedicSvc|clr_optimization|BITS|wuauserv|CDPSvc|ShellHWDetection|OneSyncSvc|MicrosoftEdgeElevationService|SysMain|IntelAudioService|DPS|AdobeARMservice'
$R.services = @(Try-Get 'services' { Get-CimInstance Win32_Service -Filter "StartMode='Auto' AND State<>'Running'" | Where-Object {
    -not $_.DelayedAutoStart -and $_.Name -notmatch '_[0-9a-f]{4,}$' -and $_.Name -notmatch "^($ignore)" -and
    -not (Test-Path ('HKLM:\SYSTEM\CurrentControlSet\Services\' + $_.Name + '\TriggerInfo')) } | ForEach-Object {
    [ordered]@{ name = $_.Name; display = $_.DisplayName; exit = $_.ExitCode } } } @())
$R.startup = @(Try-Get 'startup' { Get-CimInstance Win32_StartupCommand | ForEach-Object { [ordered]@{ name = $_.Name; cmd = (Short $_.Command 200); loc = $_.Location } } } @())

Step 'Logiciels installés'
$keys = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
$R.software = @(Try-Get 'software' { Get-ItemProperty $keys -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -and -not $_.SystemComponent -and -not $_.ParentKeyName } |
  Sort-Object DisplayName -Unique | ForEach-Object { [ordered]@{ name = $_.DisplayName; version = $_.DisplayVersion; publisher = $_.Publisher } } } @())

Step "Intégrité de l'image Windows (DISM)"
$R.dism = $(if ($isAdmin) { Try-Get 'dism' { [string](Repair-WindowsImage -Online -CheckHealth -ErrorAction Stop).ImageHealthState } } else { $null })

# ------------------------------------------------------------------ Réseau
Step 'Réseau et Internet'
$net = $R.network
$gw = Try-Get 'route' { (Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop | Sort-Object RouteMetric | Select-Object -First 1).NextHop }
$net.gateway = $gw
$net.gwPing = $(if ($gw) { Try-Get 'gwping' { Test-Connection $gw -Count 2 -Quiet } $false } else { $null })
$net.dns = Try-Get 'dns' { [bool](Resolve-DnsName www.microsoft.com -QuickTimeout -ErrorAction Stop | Select-Object -First 1) } $false
$net.internet = Try-Get 'tcp443' { $c = New-Object Net.Sockets.TcpClient; $ok = $c.ConnectAsync('1.1.1.1', 443).Wait(3000); $c.Close(); $ok } $false
$net.dnsServers = @(Try-Get 'dnsservers' { Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction Stop | Where-Object { $_.ServerAddresses } | ForEach-Object { $_.ServerAddresses } | Select-Object -Unique } @())
$net.ip = @(Try-Get 'ip' { Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop | Where-Object { $_.IPAddress -notmatch '^(127|169\.254)' } | ForEach-Object { "$($_.IPAddress)/$($_.PrefixLength) ($($_.InterfaceAlias))" } } @())
$net.apipa = @(Try-Get 'apipa' { Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop | Where-Object { $_.IPAddress -match '^169\.254' } | ForEach-Object { $_.InterfaceAlias } } @())
$w = Try-Get 'wlan' { & netsh wlan show interfaces 2>$null }
if ($w) {
  $ssid = ($w | Where-Object { $_ -match '^\s*SSID\s*:' } | Select-Object -First 1) -replace '^[^:]*:\s*', ''
  $sig = ($w | Where-Object { $_ -match '^\s*Signal\s*:' } | Select-Object -First 1) -replace '[^0-9]', ''
  if ($ssid) { $net.wifi = [ordered]@{ ssid = $ssid; signal = $(if ($sig) { [int]$sig } else { $null }) } }
}
$R.network = $net
$R.power = Try-Get 'powerplan' { ((& powercfg /getactivescheme) -join ' ') -replace '^.*\(|\).*$', '' }

$R.errors = $script:errs
$R.meta.duration = [math]::Round(((Get-Date) - $t0).TotalSeconds, 0)
$json = $R | ConvertTo-Json -Depth 6 -Compress
[IO.File]::WriteAllText($Out, $json, (New-Object Text.UTF8Encoding($false)))
Write-Output '##DONE'
