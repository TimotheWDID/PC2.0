# PC2 Diag : collecte en lecture seule, aucune modification du système.
# Le résultat est écrit en JSON dans $Out. Chaque étape écrit « n|total|libellé »
# dans $Progress : sans console, la sortie de PowerShell reste en mémoire tampon.
# $Log reçoit l'heure de début et la durée de chaque vérification : si la
# collecte reste bloquée, sa dernière ligne dit laquelle ne rend pas la main.
# $ExeDir : dossier de PC2Diag.exe. Le disque qui le porte (la clé de l'atelier)
# est retiré des disques et des volumes, toutes ses partitions comprises.
param([string]$Out = "$env:TEMP\pc2diag.json", [string]$Progress, [string]$Log, [string]$ExeDir)
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$t0 = Get-Date
$since = (Get-Date).AddDays(-30)
$R = [ordered]@{}
$script:errs = @()
$script:hung = @()
$script:step = 0
$script:stepLabel = ''
$script:stepSw = $null
$total = 14
$utf8 = New-Object Text.UTF8Encoding($false)

function Log($msg) {
  if ($Log) { try { [IO.File]::AppendAllText($Log, ("{0}  {1}`r`n" -f (Get-Date).ToString('HH:mm:ss.fff'), $msg), $utf8) } catch {} }
}
function Write-Progress-File($label) {
  if ($Progress) { try { [IO.File]::WriteAllText($Progress, ("{0}|{1}|{2}" -f $script:step, $total, $label), $utf8) } catch {} }
}
function Step($label) {
  if ($script:stepSw) { Log ("[{0,2}/{1}] terminée en {2:N1} s" -f $script:step, $total, $script:stepSw.Elapsed.TotalSeconds) }
  $script:step++
  $script:stepLabel = $label
  $script:stepSw = [Diagnostics.Stopwatch]::StartNew()
  Log ("[{0,2}/{1}] {2}" -f $script:step, $total, $label)
  Write-Progress-File $label
  Write-Output ("[{0,2}/{1}] {2}" -f $script:step, $total, $label)
}
# Chaque vérification est notée avant de démarrer, dans le journal et dans le
# libellé affiché : un blocage montre ainsi son nom à l'écran.
function Try-Get($name, [scriptblock]$sb, $default = $null) {
  Log "      $name..."
  Write-Progress-File "$script:stepLabel ($name)"
  $sw = [Diagnostics.Stopwatch]::StartNew()
  try { $r = & $sb; Log ("      $name : {0} ms" -f $sw.ElapsedMilliseconds); $r }
  catch {
    Log ("      $name : ERREUR après {0} ms : {1}" -f $sw.ElapsedMilliseconds, $_.Exception.Message)
    $script:errs += [pscustomobject]@{ check = $name; msg = $_.Exception.Message }; $default
  }
}
# Exécute $sb dans un runspace à part et l'abandonne au bout de $sec secondes :
# un appel WMI ou un pilote de disque qui ne répond plus ne bloque plus la collecte.
# $sb ne voit pas les variables ni les fonctions de ce script, d'où $argList.
function Invoke-Timed($name, $sec, [scriptblock]$sb, $argList = @()) {
  $ps = [powershell]::Create()
  [void]$ps.AddScript($sb.ToString())
  foreach ($a in $argList) { [void]$ps.AddArgument($a) }
  $h = $ps.BeginInvoke()
  if (-not $h.AsyncWaitHandle.WaitOne($sec * 1000)) {
    $script:hung += $name
    try { [void]$ps.BeginStop($null, $null) } catch {}
    throw "pas de réponse au bout de $sec s, vérification abandonnée"
  }
  try { $ps.EndInvoke($h) } finally { $ps.Dispose() }
}
# Lance un exécutable et le tue s'il n'a pas rendu la main au bout de $sec secondes.
function Run-Exe($exe, $argStr, $sec) {
  $psi = New-Object Diagnostics.ProcessStartInfo $exe, $argStr
  $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
  $p = [Diagnostics.Process]::Start($psi)
  $o = $p.StandardOutput.ReadToEndAsync(); $null = $p.StandardError.ReadToEndAsync()
  if (-not $p.WaitForExit($sec * 1000)) { try { $p.Kill() } catch {}; throw "$exe $argStr : pas de réponse au bout de $sec s, arrêté" }
  $o.Result
}
# Taille des fichiers sous $paths, sans suivre les jonctions et en s'arrêtant
# au bout de $sec secondes : un dossier Temp de plusieurs centaines de milliers
# de fichiers prenait plusieurs minutes avec Get-ChildItem -Recurse.
function Dir-Size($paths, $sec) {
  $sw = [Diagnostics.Stopwatch]::StartNew(); $sum = [long]0; $files = 0; $partial = $false
  $stack = New-Object 'System.Collections.Generic.Stack[string]'
  foreach ($p in $paths) { if ($p -and [IO.Directory]::Exists($p)) { $stack.Push($p) } }
  while ($stack.Count -gt 0) {
    if ($sw.Elapsed.TotalSeconds -gt $sec) { $partial = $true; break }
    $d = New-Object IO.DirectoryInfo $stack.Pop()
    try {
      foreach ($e in $d.EnumerateFileSystemInfos()) {
        if ($e -is [IO.DirectoryInfo]) { if (-not ($e.Attributes -band [IO.FileAttributes]::ReparsePoint)) { $stack.Push($e.FullName) } }
        else { $sum += $e.Length; $files++; if (($files % 5000) -eq 0 -and $sw.Elapsed.TotalSeconds -gt $sec) { $partial = $true; break } }
      }
    } catch {}
  }
  [pscustomobject]@{ bytes = $sum; files = $files; partial = $partial; seconds = [math]::Round($sw.Elapsed.TotalSeconds, 1) }
}
function D($d) { if ($d) { try { ([datetime]$d).ToString('yyyy-MM-ddTHH:mm:ss') } catch { $null } } else { $null } }
function GB($b) { if ($b) { [math]::Round([double]$b / 1GB, 1) } else { 0 } }
function Ev($log, $ids, $provider) {
  $f = @{ LogName = $log; StartTime = $since }
  if ($ids) { $f.Id = $ids }
  if ($provider) { $f.ProviderName = $provider }
  try { @(Get-WinEvent -FilterHashtable $f -ErrorAction Stop) } catch { @() }
}
function Reg($path, $name) { try { (Get-ItemProperty -Path $path -Name $name -ErrorAction Stop).$name } catch { $null } }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

# ---------------------------------------------------------------- Système
Step "Système et carte mère"
$os = Get-CimInstance Win32_OperatingSystem
$cs = Get-CimInstance Win32_ComputerSystem
$bios = Try-Get 'bios' { Get-CimInstance Win32_BIOS }
$bb = Try-Get 'baseboard' { Get-CimInstance Win32_BaseBoard }
$csp = Try-Get 'csproduct' { Get-CimInstance Win32_ComputerSystemProduct }
$cv = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
# Textes laissés par défaut dans le BIOS des cartes mères vendues seules
# (« To be filled by O.E.M. », « System manufacturer »…) : sur un PC assemblé,
# le fabricant et le modèle sont alors ceux de la carte mère.
function Real($v) {
  $t = ([string]$v).Trim()
  if ($t -match '^(to be filled by o\.?e\.?m\.?|system (manufacturer|product name|version|serial number)|default string|o\.?e\.?m\.?|oem|not (applicable|specified|available)|none|n/a|undefined|empty|base board .*|0+|x+|1234567890|123456789)?$') { $null } else { $t }
}
$assembled = -not (Real $cs.Manufacturer) -or -not (Real $cs.Model)
$R.meta = [ordered]@{
  computer = $env:COMPUTERNAME; user = "$env:USERDOMAIN\$env:USERNAME"; isAdmin = $isAdmin
  os = $os.Caption; edition = (Reg $cv 'EditionID'); displayVersion = (Reg $cv 'DisplayVersion')
  build = [int]$os.BuildNumber; ubr = (Reg $cv 'UBR'); arch = $os.OSArchitecture
  installDate = (D $os.InstallDate); lastBoot = (D $os.LastBootUpTime)
  uptimeDays = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalDays, 1)
  manufacturer = $(if (Real $cs.Manufacturer) { Real $cs.Manufacturer } else { Real $bb.Manufacturer })
  model = $(if (Real $cs.Model) { Real $cs.Model } else { Real $bb.Product })
  family = (Real $cs.SystemFamily); assembled = $assembled
  productName = (Real $csp.Version); serial = $(if (Real $bios.SerialNumber) { Real $bios.SerialNumber } else { Real $bb.SerialNumber })
  board = (($bb.Manufacturer, $bb.Product) -join ' ').Trim()
  bios = $bios.SMBIOSBIOSVersion; biosDate = (D $bios.ReleaseDate)
  domain = $cs.Domain; partOfDomain = $cs.PartOfDomain
  scanDate = (D (Get-Date)); firmware = $env:firmware_type; timezone = (Try-Get 'tz' { (Get-TimeZone).DisplayName })
}

# ---------------------------------------------------------------- CPU / RAM / GPU
Step "Processeur, mémoire, carte graphique, écrans"
$cpu = @(Get-CimInstance Win32_Processor)
$R.cpu = [ordered]@{
  name = ($cpu[0].Name).Trim(); cores = ($cpu | Measure-Object NumberOfCores -Sum).Sum
  threads = ($cpu | Measure-Object NumberOfLogicalProcessors -Sum).Sum
  maxMHz = $cpu[0].MaxClockSpeed; curMHz = $cpu[0].CurrentClockSpeed
  socket = $cpu[0].SocketDesignation; virt = $cpu[0].VirtualizationFirmwareEnabled
  load = (Try-Get 'cpuload' { [math]::Round(($cpu | Measure-Object LoadPercentage -Average).Average, 0) })
}
$R.mem = [ordered]@{
  totalGB = (GB $cs.TotalPhysicalMemory)
  freeGB = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
  usedPct = [math]::Round(100 - ($os.FreePhysicalMemory / $os.TotalVisibleMemorySize * 100), 0)
  commitPct = [math]::Round(100 - ($os.FreeVirtualMemory / $os.TotalVirtualMemorySize * 100), 0)
  modules = @(Try-Get 'dimm' { Get-CimInstance Win32_PhysicalMemory | ForEach-Object {
    [ordered]@{ slot = $_.DeviceLocator; sizeGB = (GB $_.Capacity); speed = $_.Speed; configured = $_.ConfiguredClockSpeed
      maker = ($_.Manufacturer -as [string]).Trim(); part = ($_.PartNumber -as [string]).Trim() } } } @())
  slots = (Try-Get 'memslots' { (Get-CimInstance Win32_PhysicalMemoryArray | Measure-Object MemoryDevices -Sum).Sum })
}
$R.gpu = @(Try-Get 'gpu' { Get-CimInstance Win32_VideoController | ForEach-Object {
  [ordered]@{ name = $_.Name; driver = $_.DriverVersion; driverDate = (D $_.DriverDate); status = $_.Status
    res = $(if ($_.CurrentHorizontalResolution) { "$($_.CurrentHorizontalResolution) x $($_.CurrentVerticalResolution) @ $($_.CurrentRefreshRate) Hz" } else { $null })
    vramGB = (GB $_.AdapterRAM) } } } @())
$R.monitors = @(Try-Get 'monitors' { Get-CimInstance -Namespace root\wmi WmiMonitorID | ForEach-Object {
  $n = ($_.UserFriendlyName | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }) -join ''
  $m = ($_.ManufacturerName | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }) -join ''
  [ordered]@{ name = $n; maker = $m; year = $_.YearOfManufacture } } } @())
$R.audio = @(Try-Get 'audio' { Get-CimInstance Win32_SoundDevice | ForEach-Object { $_.Name } } @())
$R.thermal = @(Try-Get 'thermal' { Get-CimInstance -Namespace root\wmi MSAcpi_ThermalZoneTemperature | ForEach-Object {
  [ordered]@{ zone = ($_.InstanceName -split '\\')[-1]; c = [math]::Round($_.CurrentTemperature / 10 - 273.15, 0) } } } @())
$R.topProcesses = @(Try-Get 'procs' { Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 8 | ForEach-Object {
  [ordered]@{ name = $_.ProcessName; ramMB = [math]::Round($_.WorkingSet64 / 1MB, 0) } } } @())

# ---------------------------------------------------------------- Disques
Step "Disques et état SMART"
# Clé de l'atelier : numéro du disque physique d'où tourne l'exe et lettres de
# toutes ses partitions, seulement si ce disque est en USB. Jamais le disque de
# Windows (exe copié sur le PC du client).
$toolDisk = $null; $toolLetters = @()
$exeLetter = if ($ExeDir -match '^([A-Za-z]):') { $Matches[1].ToUpper() } else { $null }
if ($exeLetter) {
  $tk = Try-Get 'toolkey' {
    Invoke-Timed 'toolkey' 20 {
      param($letter)
      $ErrorActionPreference = 'Stop'
      try {
        $n = (Get-Partition -DriveLetter $letter).DiskNumber
        if ([string](Get-Disk -Number $n).BusType -ne 'USB') { return '' }
        $l = @(Get-Partition -DiskNumber $n | Where-Object { "$($_.DriveLetter)" -match '^[A-Za-z]$' } | ForEach-Object { "$($_.DriveLetter):".ToUpper() })
      } catch {
        # Windows 7 : pas de module Storage, associations WMI
        $dd = Get-CimInstance -Query "ASSOCIATORS OF {Win32_LogicalDisk.DeviceID='$($letter):'} WHERE AssocClass=Win32_LogicalDiskToPartition" |
          Get-CimAssociatedInstance -ResultClassName Win32_DiskDrive | Select-Object -First 1
        if (-not $dd -or $dd.InterfaceType -ne 'USB') { return '' }
        $n = $dd.Index
        $l = @($dd | Get-CimAssociatedInstance -ResultClassName Win32_DiskPartition | Get-CimAssociatedInstance -ResultClassName Win32_LogicalDisk | ForEach-Object { $_.DeviceID })
      }
      '{0}|{1}' -f $n, ($l -join ',')
    } @($exeLetter)
  }
  if ($tk) {
    $n, $l = "$tk" -split '\|', 2
    $letters = @($l -split ',' | Where-Object { $_ })
    if ($n -ne '' -and $letters -notcontains $env:SystemDrive) { $toolDisk = $n; $toolLetters = $letters }
  }
  if ($toolLetters) {
    $R.toolKey = [ordered]@{ disk = $toolDisk; letters = $toolLetters }
    Log ("      clé de l'atelier : disque {0}, lecteurs {1}, exclus de l'analyse" -f $toolDisk, ($toolLetters -join ' '))
  }
}
$R.disks = @(Try-Get 'physicaldisk' { Get-PhysicalDisk | Where-Object { $null -eq $toolDisk -or [string]$_.DeviceId -ne $toolDisk } | ForEach-Object {
  $pd = $_; $rc = $null
  try { $rc = $pd | Get-StorageReliabilityCounter -ErrorAction Stop } catch {}
  [ordered]@{ name = $pd.FriendlyName; serial = ($pd.SerialNumber -as [string]).Trim(); media = [string]$pd.MediaType; bus = [string]$pd.BusType
    sizeGB = (GB $pd.Size); health = [string]$pd.HealthStatus; op = (($pd.OperationalStatus | ForEach-Object { [string]$_ }) -join ', ')
    firmware = $pd.FirmwareVersion
    wear = $(if ($rc) { $rc.Wear } else { $null }); temp = $(if ($rc) { $rc.Temperature } else { $null }); tempMax = $(if ($rc) { $rc.TemperatureMax } else { $null })
    hours = $(if ($rc) { $rc.PowerOnHours } else { $null }); readErr = $(if ($rc) { $rc.ReadErrorsUncorrected } else { $null })
    writeErr = $(if ($rc) { $rc.WriteErrorsUncorrected } else { $null }); starts = $(if ($rc) { $rc.StartStopCycleCount } else { $null }) } } } @())
$R.smartPredict = @(Try-Get 'smartpredict' { Get-CimInstance -Namespace root\wmi MSStorageDriver_FailurePredictStatus | Where-Object { $_.PredictFailure } | ForEach-Object { $_.InstanceName } } @())

Step "Volumes, espace libre, BitLocker"
# Get-BitLockerVolume interroge tous les volumes (lecteurs de cartes, clés USB
# en panne compris) et peut ne jamais répondre : lecture directe de la classe
# WMI, limitée dans le temps.
$bl = @{}
Try-Get 'bitlocker' {
  Invoke-Timed 'bitlocker' 20 {
    $ErrorActionPreference = 'Stop'
    Get-CimInstance -Namespace 'root\cimv2\Security\MicrosoftVolumeEncryption' -ClassName Win32_EncryptableVolume | Where-Object { $_.DriveLetter } |
      ForEach-Object { '{0}|{1}' -f $_.DriveLetter, $(switch ([int]$_.ProtectionStatus) { 0 { 'Off' } 1 { 'On' } default { 'Unknown' } }) }
  } | ForEach-Object { $k, $v = "$_" -split '\|', 2; $bl[$k.TrimEnd('\')] = $v }
} | Out-Null
$ld = @(Try-Get 'volumes' { Invoke-Timed 'volumes' 30 { $ErrorActionPreference = 'Stop'; Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' } } @())
$R.volumes = @($ld | Where-Object { $toolLetters -notcontains $_.DeviceID } | ForEach-Object {
  $v = $_; $dirty = $null
  if ($isAdmin) {
    $q = Try-Get "fsutil $($v.DeviceID)" { Run-Exe 'fsutil.exe' "dirty query $($v.DeviceID)" 15 }
    if ($q) { $dirty = ($q -notmatch 'NOT|PAS|n.est pas') -and ($q -match 'Dirty|d.fectueux|endommag|sale|incorrect') }
  }
  [ordered]@{ letter = $v.DeviceID; label = $v.VolumeName; fs = $v.FileSystem; sizeGB = (GB $v.Size); freeGB = (GB $v.FreeSpace)
    freePct = $(if ($v.Size) { [math]::Round($v.FreeSpace / $v.Size * 100, 0) } else { $null }); dirty = $dirty; bitlocker = $bl[$v.DeviceID] } })
$tempPaths = @($env:TEMP, "$env:windir\Temp", "$env:windir\SoftwareDistribution\Download")
$junk = Try-Get 'temp' { Dir-Size $tempPaths 30 }
if ($junk) {
  Log ("      temp : {0} fichiers, {1} Go{2}" -f $junk.files, (GB $junk.bytes), $(if ($junk.partial) { ', comptage interrompu après 30 s' } else { '' }))
  $R.junkGB = (GB $junk.bytes); $R.junkPartial = $junk.partial
} else { $R.junkGB = 0 }

# ---------------------------------------------------------------- Batterie
Step "Batterie"
# Repli : quand les classes WMI ne renvoient pas la capacité, powercfg /batteryreport la lit dans le firmware.
function Get-BatteryReport {
  try {
    $p = Join-Path $env:TEMP 'pc2diag_batteryreport.xml'
    & powercfg /batteryreport /output $p /xml 2>$null | Out-Null
    if (-not (Test-Path $p)) { return $null }
    [xml]$x = Get-Content $p -Raw -ErrorAction Stop
    Remove-Item $p -ErrorAction SilentlyContinue
    $design = 0; $full = 0; $cyc = 0; $got = $false
    foreach ($node in $x.SelectNodes('//*')) {
      switch ($node.LocalName) {
        'DesignCapacity'     { if ($node.'#text') { $design += [double]$node.'#text'; $got = $true } }
        'FullChargeCapacity' { if ($node.'#text') { $full += [double]$node.'#text'; $got = $true } }
        'CycleCount'         { if ($node.'#text') { $cyc += [int]$node.'#text' } }
      }
    }
    if (-not $got) { return $null }
    return [ordered]@{ design = [int]$design; full = [int]$full; cycles = $(if ($cyc -gt 0) { $cyc } else { $null }) }
  } catch { return $null }
}
$R.battery = Try-Get 'battery' {
  $b = Get-CimInstance Win32_Battery
  if (-not $b) { return [ordered]@{ present = $false } }
  $design = (Get-CimInstance -Namespace root\wmi BatteryStaticData -ErrorAction SilentlyContinue | Select-Object -First 1).DesignedCapacity
  $full = (Get-CimInstance -Namespace root\wmi BatteryFullChargedCapacity -ErrorAction SilentlyContinue | Select-Object -First 1).FullChargedCapacity
  $cyc = (Get-CimInstance -Namespace root\wmi BatteryCycleCount -ErrorAction SilentlyContinue | Select-Object -First 1).CycleCount
  $src = 'WMI'
  if (-not $design -or -not $full) {
    $rep = Get-BatteryReport
    if ($rep) {
      if (-not $design -and $rep.design) { $design = $rep.design; $src = 'powercfg' }
      if (-not $full -and $rep.full) { $full = $rep.full; $src = 'powercfg' }
      if (-not $cyc -and $rep.cycles) { $cyc = $rep.cycles }
    }
  }
  [ordered]@{ present = $true; name = $b.Name; charge = $b.EstimatedChargeRemaining; design = $design; full = $full; cycles = $cyc; source = $src
    wearPct = $(if ($design -and $full) { [math]::Round((1 - $full / $design) * 100, 1) } else { $null }) }
} ([ordered]@{ present = $false })

# ---------------------------------------------------------------- Périphériques
Step "Périphériques et pilotes"
$R.devices = @(Try-Get 'pnp' { Get-CimInstance Win32_PnPEntity -Filter 'ConfigManagerErrorCode<>0' | Where-Object { $_.ConfigManagerErrorCode -ne 45 } | ForEach-Object {
  [ordered]@{ name = $(if ($_.Name) { $_.Name } else { $_.DeviceID }); cls = $_.PNPClass; code = $_.ConfigManagerErrorCode; id = $_.DeviceID } } } @())
$R.network = [ordered]@{}
$R.network.adapters = @(Try-Get 'netadapters' { Get-NetAdapter -Physical | ForEach-Object {
  [ordered]@{ name = $_.Name; desc = $_.InterfaceDescription; status = [string]$_.Status; speed = $_.LinkSpeed; mac = $_.MacAddress; media = [string]$_.PhysicalMediaType; driver = $_.DriverVersion; driverDate = $_.DriverDate } } } @())

# ---------------------------------------------------------------- Stabilité
Step "Journaux d'événements (30 derniers jours)"
$ev = [ordered]@{}
$ev.kernelPower41 = (Ev 'System' 41 'Microsoft-Windows-Kernel-Power').Count
$ev.unexpected6008 = (Ev 'System' 6008 'EventLog').Count
$bs = Ev 'System' 1001 'Microsoft-Windows-WER-SystemErrorReporting'
if ($bs.Count -eq 0) { $bs = Ev 'System' 1001 'BugCheck' }
$ev.bsod = @($bs | Select-Object -First 10 | ForEach-Object { [ordered]@{ date = (D $_.TimeCreated); code = $(try { [string]$_.Properties[0].Value } catch { '' }); msg = (($_.Message -as [string]) -replace '\s+', ' ').Substring(0, [math]::Min(220, ($_.Message -as [string]).Length)) } })
$wh = Ev 'System' $null 'Microsoft-Windows-WHEA-Logger'
$ev.whea = $wh.Count
$ev.wheaSample = @($wh | Select-Object -First 3 | ForEach-Object { (($_.Message -as [string]) -replace '\s+', ' ').Substring(0, [math]::Min(200, ($_.Message -as [string]).Length)) })
$ev.disk = @(Ev 'System' @(7, 11, 51, 153) 'disk').Count
$ev.ntfs = @(Ev 'System' @(55, 98, 137) 'Ntfs').Count
$ev.storReset = @(Ev 'System' 129 $null | Where-Object { $_.ProviderName -match 'stor|nvme|iaStor' }).Count
$ac = Ev 'Application' 1000 'Application Error'
$ev.appCrashes = @($ac | ForEach-Object { try { [string]$_.Properties[0].Value } catch { '?' } } | Group-Object | Sort-Object Count -Descending | Select-Object -First 8 | ForEach-Object { [ordered]@{ app = $_.Name; count = $_.Count } })
$ev.appCrashTotal = $ac.Count
$ah = Ev 'Application' 1002 'Application Hang'
$ev.appHangs = @($ah | ForEach-Object { try { [string]$_.Properties[0].Value } catch { '?' } } | Group-Object | Sort-Object Count -Descending | Select-Object -First 5 | ForEach-Object { [ordered]@{ app = $_.Name; count = $_.Count } })
$ev.svcCrash = @(Ev 'System' @(7031, 7034) 'Service Control Manager' | ForEach-Object { try { [string]$_.Properties[0].Value } catch { '?' } } | Group-Object | Sort-Object Count -Descending | Select-Object -First 5 | ForEach-Object { [ordered]@{ svc = $_.Name; count = $_.Count } })
$md = Try-Get 'memdiag' { Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-MemoryDiagnostics-Results' } -MaxEvents 1 -ErrorAction Stop }
$ev.memDiag = $(if ($md) { [ordered]@{ date = (D $md.TimeCreated); id = $md.Id } } else { $null })
$ev.dumps = Try-Get 'dumps' { $f = @(Get-ChildItem "$env:windir\Minidump" -Filter *.dmp -ErrorAction SilentlyContinue); [ordered]@{ count = $f.Count; last = (D ($f | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime) } } ([ordered]@{ count = 0 })
$R.events = $ev
$R.reliability = Try-Get 'reliability' { $m = Get-CimInstance Win32_ReliabilityStabilityMetrics -ErrorAction Stop | Sort-Object TimeGenerated -Descending | Select-Object -First 1; if ($m) { [math]::Round($m.SystemStabilityIndex, 1) } else { $null } }

# ---------------------------------------------------------------- Mises à jour
Step "Windows Update"
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
$hf = Try-Get 'hotfix' { Get-HotFix | Where-Object { $_.InstalledOn } | Sort-Object InstalledOn -Descending | Select-Object -First 1 }
if ($hf) { $up.lastHotfix = (D $hf.InstalledOn); $up.lastHotfixId = $hf.HotFixID }
$up.rebootPending = (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending') -or (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired')
$up.wuService = Try-Get 'wusvc' { [string](Get-Service wuauserv).StartType }
$up.pausedUntil = Reg 'HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings' 'PauseUpdatesExpiryTime'
$R.updates = $up

# ---------------------------------------------------------------- Sécurité
Step "Sécurité (antivirus, pare-feu, chiffrement, comptes)"
$sec = [ordered]@{}
$sec.defender = Try-Get 'defender' { $m = Get-MpComputerStatus; [ordered]@{ av = $m.AntivirusEnabled; rtp = $m.RealTimeProtectionEnabled; sigAge = $m.AntivirusSignatureAge; tamper = $m.IsTamperProtected; mode = [string]$m.AMRunningMode; lastScanDays = $m.QuickScanAge } }
$sec.av = @(Try-Get 'securitycenter' { Get-CimInstance -Namespace root\SecurityCenter2 AntiVirusProduct | ForEach-Object {
  $st = [int]$_.productState; [ordered]@{ name = $_.displayName; enabled = (($st -band 0x1000) -ne 0); upToDate = (($st -band 0x10) -eq 0) } } } @())
$sec.firewall = @(Try-Get 'firewall' { Get-NetFirewallProfile | ForEach-Object { [ordered]@{ profile = [string]$_.Name; enabled = [bool]$_.Enabled } } } @())
$sec.secureBoot = Try-Get 'secureboot' { Confirm-SecureBootUEFI }
$sec.tpm = Try-Get 'tpm' { $t = Get-Tpm; $w = Get-CimInstance -Namespace root/cimv2/Security/MicrosoftTpm -ClassName Win32_Tpm -ErrorAction SilentlyContinue
  [ordered]@{ present = $t.TpmPresent; ready = $t.TpmReady; enabled = $t.TpmEnabled; specVersion = $w.SpecVersion } }
$sec.uac = Reg 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' 'EnableLUA'
$sec.uacPrompt = Reg 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' 'ConsentPromptBehaviorAdmin'
$sec.smb1 = Try-Get 'smb1' { (Get-SmbServerConfiguration).EnableSMB1Protocol }
$sec.rdp = ((Reg 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server' 'fDenyTSConnections') -eq 0)
$sec.rdpNla = ((Reg 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' 'UserAuthentication') -eq 1)
$sec.autologon = ((Reg 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' 'AutoAdminLogon') -eq '1')
$sec.autologonPwd = [bool](Reg 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' 'DefaultPassword')
$sec.users = @(Try-Get 'localusers' { Get-LocalUser | ForEach-Object { [ordered]@{ name = $_.Name; enabled = $_.Enabled; sid = $_.SID.Value; pwdRequired = $_.PasswordRequired; lastLogon = (D $_.LastLogon) } } } @())
$sec.admins = @(Try-Get 'admins' { Get-LocalGroupMember -SID 'S-1-5-32-544' | ForEach-Object { $_.Name } } @())
$sec.lsaPpl = Reg 'HKLM:\SYSTEM\CurrentControlSet\Control\Lsa' 'RunAsPPL'
$R.security = $sec

# ---------------------------------------------------------------- Logiciel
Step "Services et démarrage"
$ignore = 'gupdate|gupdatem|edgeupdate|edgeupdatem|GoogleUpdater|MapsBroker|sppsvc|RemoteRegistry|TrustedInstaller|WbioSrvc|tiledatamodelsvc|DoSvc|UsoSvc|WaaSMedicSvc|clr_optimization|BITS|wuauserv|CDPSvc|ShellHWDetection|OneSyncSvc|MicrosoftEdgeElevationService|SysMain|IntelAudioService|DPS|AdobeARMservice'
$R.services = @(Try-Get 'services' { Get-CimInstance Win32_Service -Filter "StartMode='Auto' AND State<>'Running'" | Where-Object {
    -not $_.DelayedAutoStart -and $_.Name -notmatch '_[0-9a-f]{4,}$' -and $_.Name -notmatch "^($ignore)" -and
    -not (Test-Path ("HKLM:\SYSTEM\CurrentControlSet\Services\" + $_.Name + "\TriggerInfo")) } | ForEach-Object {
    [ordered]@{ name = $_.Name; display = $_.DisplayName; exit = $_.ExitCode } } } @())
$R.startup = @(Try-Get 'startup' { Get-CimInstance Win32_StartupCommand | ForEach-Object { [ordered]@{ name = $_.Name; cmd = $_.Command; loc = $_.Location } } } @())

Step "Logiciels installés"
$keys = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
$R.software = @(Try-Get 'software' { Get-ItemProperty $keys -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -and -not $_.SystemComponent -and -not $_.ParentKeyName } |
  Sort-Object DisplayName -Unique | ForEach-Object { [ordered]@{ name = $_.DisplayName; version = $_.DisplayVersion; publisher = $_.Publisher; date = $_.InstallDate } } } @())

Step "Intégrité de l'image Windows (DISM CheckHealth)"
# dism.exe en anglais (/English) : le verdict se lit de la même façon quelle que
# soit la langue de Windows. Une réponse qui n'est aucun des trois verdicts connus
# laisse « non vérifiée » plutôt que de signaler à tort une image endommagée.
# CheckHealth ne fait que relire l'état noté par le dernier contrôle (ScanHealth,
# RestoreHealth, Windows Update) : il répond en quelques secondes.
$R.dism = $(if ($isAdmin) { Try-Get 'dism' {
  $o = (& "$env:SystemRoot\System32\dism.exe" /Online /Cleanup-Image /CheckHealth /English | Out-String)
  if ($o -match 'No component store corruption detected') { 'Healthy' }
  elseif ($o -match 'component store cannot be repaired|not repairable') { 'NonRepairable' }
  elseif ($o -match 'component store is repairable') { 'Repairable' }
  else { throw ("verdict DISM introuvable (code {0}) : {1}" -f $LASTEXITCODE, (($o -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 2) -join ' ')) }
} } else { $null })

# ---------------------------------------------------------------- Réseau
Step "Réseau et Internet"
$net = $R.network
$gw = Try-Get 'route' { (Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -First 1).NextHop }
$net.gateway = $gw
$net.gwPing = $(if ($gw) { Try-Get 'gwping' { Test-Connection $gw -Count 2 -Quiet } $false } else { $null })
$net.dns = Try-Get 'dns' { [bool](Resolve-DnsName www.microsoft.com -QuickTimeout -ErrorAction Stop | Select-Object -First 1) } $false
$net.internet = Try-Get 'tcp443' { $c = New-Object Net.Sockets.TcpClient; $ok = $c.ConnectAsync('1.1.1.1', 443).Wait(3000); $c.Close(); $ok } $false
$net.dnsServers = @(Try-Get 'dnsservers' { Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object { $_.ServerAddresses } | ForEach-Object { $_.ServerAddresses } | Select-Object -Unique } @())
$net.ip = @(Try-Get 'ip' { Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^(127|169\.254)' } | ForEach-Object { "$($_.IPAddress)/$($_.PrefixLength) ($($_.InterfaceAlias))" } } @())
# 169.254 : seulement sur une carte branchée (Up) qui n'a pas d'autre adresse.
# Une carte débranchée, le Wi-Fi non connecté et les cartes virtuelles « Wi-Fi
# Direct » (« Connexion au réseau local* 1, 2 ») gardent toujours une adresse
# 169.254 sans que ce soit une panne.
$net.apipa = @(Try-Get 'apipa' {
  $up = @(Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.InterfaceDescription -notmatch 'Wi-Fi Direct|Virtual|Hyper-V|VirtualBox|VMware|Bluetooth' } | ForEach-Object { $_.ifIndex })
  $all = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $up -contains $_.InterfaceIndex })
  $all | Where-Object { $_.IPAddress -match '^169\.254' } | Where-Object { $i = $_.InterfaceIndex; -not ($all | Where-Object { $_.InterfaceIndex -eq $i -and $_.IPAddress -notmatch '^169\.254' }) } | ForEach-Object { $_.InterfaceAlias } | Select-Object -Unique } @())
$w = Try-Get 'wlan' { & netsh wlan show interfaces 2>$null }
if ($w) {
  $ssid = ($w | Where-Object { $_ -match '^\s*SSID\s*:' } | Select-Object -First 1) -replace '^[^:]*:\s*', ''
  $sig = ($w | Where-Object { $_ -match '^\s*Signal\s*:' } | Select-Object -First 1) -replace '[^0-9]', ''
  if ($ssid) { $net.wifi = [ordered]@{ ssid = $ssid; signal = $(if ($sig) { [int]$sig } else { $null }) } }
}
$R.network = $net

Step "Finalisation"
$R.power = Try-Get 'powerplan' { (& powercfg /getactivescheme) -replace '^.*\(|\).*$', '' }
$R.errors = $script:errs
$R.meta.duration = [math]::Round(((Get-Date) - $t0).TotalSeconds, 0)
$R.meta.hung = @($script:hung)
$json = $R | ConvertTo-Json -Depth 6 -Compress
[IO.File]::WriteAllText($Out, $json, $utf8)
Log ("[{0,2}/{1}] terminée en {2:N1} s" -f $script:step, $total, $script:stepSw.Elapsed.TotalSeconds)
Log "Collecte terminée en $($R.meta.duration) s, $($script:errs.Count) vérification(s) en erreur$(if ($script:hung) { ', abandonnée(s) faute de réponse : ' + ($script:hung -join ', ') })."
Write-Output "Collecte terminée en $($R.meta.duration) s."
# Une vérification abandonnée garde son fil d'exécution bloqué, qui empêcherait
# PowerShell de se terminer.
if ($script:hung) { [Environment]::Exit(0) }
