# PC2 Diag : lecture des journaux d'événements de Windows, en lecture seule.
# Erreurs et avertissements des journaux Système et Application, plus quelques
# jalons (démarrages, arrêts, mises à jour, sortie de veille, antivirus), écrits
# en JSON pour l'application qui les regroupe et les explique.
param([string]$Out, [int]$Days = 7, [int]$Max = 2000)
$ErrorActionPreference = 'SilentlyContinue'
$started = Get-Date
$start = $started.AddDays(-$Days)

$queries = @(
  @{ n = 'System'; max = $Max; f = @{ LogName = 'System'; Level = 1, 2, 3; StartTime = $start } },
  @{ n = 'Application'; max = $Max; f = @{ LogName = 'Application'; Level = 1, 2, 3; StartTime = $start } },
  @{ n = 'Jalons'; max = 800; f = @{ LogName = 'System'; Id = 1, 19, 41, 1074, 6005, 6006, 6008, 7045; StartTime = $start } },
  @{ n = 'Chkdsk'; max = 50; f = @{ LogName = 'Application'; ProviderName = 'Microsoft-Windows-Wininit', 'Chkdsk'; Id = 1001, 26212, 26214; StartTime = $start } },
  @{ n = 'Antivirus'; max = 300; f = @{ LogName = 'Microsoft-Windows-Windows Defender/Operational'; Id = 1116, 1117, 1118, 1119, 2001, 3002, 5001, 5008; StartTime = $start } }
)

$seen = @{}
$events = New-Object System.Collections.Generic.List[object]
$truncated = @()
$errors = @()
foreach ($q in $queries) {
  try {
    $list = @(Get-WinEvent -FilterHashtable $q.f -MaxEvents $q.max -ErrorAction Stop)
  } catch {
    # « aucun événement » est aussi une exception de Get-WinEvent
    # (le journal de l'antivirus manque si Defender est remplacé : sans importance)
    if ($_.FullyQualifiedErrorId -notmatch 'NoMatchingEventsFound' -and $q.n -in 'System', 'Application') { $errors += ($q.n + ' : ' + $_.Exception.Message) }
    continue
  }
  if ($list.Count -ge $q.max -and $q.n -in 'System', 'Application') { $truncated += $q.n }
  foreach ($e in $list) {
    $k = $e.LogName + '|' + $e.RecordId
    if ($seen.ContainsKey($k)) { continue }
    $seen[$k] = $true
    $msg = $null
    try { $msg = $e.Message } catch {}
    $props = @($e.Properties | Select-Object -First 8 | ForEach-Object { $v = [string]$_.Value; if ($v.Length -gt 300) { $v.Substring(0, 300) } else { $v } })
    if (-not $msg) { $msg = ($props | Where-Object { $_ }) -join ' | ' }
    if ($msg.Length -gt 2000) { $msg = $msg.Substring(0, 2000) + '…' }
    $events.Add([ordered]@{
      t   = $e.TimeCreated.ToUniversalTime().ToString('o')
      log = $e.LogName
      src = $e.ProviderName
      id  = $e.Id
      lvl = [int]$e.Level
      rec = $e.RecordId
      msg = $msg
      p   = $props
    })
  }
}

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$res = [ordered]@{
  days      = $Days
  from      = $start.ToUniversalTime().ToString('o')
  to        = $started.ToUniversalTime().ToString('o')
  admin     = $admin
  truncated = $truncated
  errors    = $errors
  seconds   = [math]::Round(((Get-Date) - $started).TotalSeconds, 1)
  events    = $events
}
[IO.File]::WriteAllText($Out, ($res | ConvertTo-Json -Depth 4 -Compress), (New-Object Text.UTF8Encoding $false))
