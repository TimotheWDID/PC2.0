package main

// Partitions système (EFI, MSR, récupération, « Réservé au système ») qui ont
// reçu une lettre de lecteur par erreur, le plus souvent après une conversion
// MBR → GPT ou un clonage : elles apparaissent dans l'Explorateur alors
// qu'elles devraient rester cachées. L'analyse les signale (collect.ps1) et la
// réparation « hidesys » leur retire la lettre. Les partitions elles-mêmes ne
// sont jamais supprimées ni modifiées.
//
// Find-SysParts est partagé par l'analyse et la réparation : collect.ps1 le
// reçoit à la place de la ligne « #@SYSPARTS@ ».
//
// Garde-fous : jamais le lecteur de Windows, jamais un volume qui contient un
// dossier Windows\System32, jamais un disque USB (clé de l'atelier, disque
// externe), et la détection par le contenu ne vaut que sous 3 Go.
const sysPartsFindPS = `function Find-SysParts {
  $EFI = '{c12a7328-f81f-11d2-ba4b-00a0c93ec93b}'; $MSR = '{e3c9e316-0b5c-4db8-817d-f92df00215ae}'; $REC = '{de94bba4-06d1-4d40-a16a-bfd50179d6ac}'
  $sys = "$env:SystemDrive".TrimEnd(':').ToUpper()
  $usb = @{}
  foreach ($d in @(Get-Disk -ErrorAction Stop)) { if ([string]$d.BusType -eq 'USB') { $usb["$($d.Number)"] = $true } }
  foreach ($p in @(Get-Partition -ErrorAction Stop)) {
    $l = "$($p.DriveLetter)".ToUpper()
    if ($l -notmatch '^[A-Z]$' -or $l -eq $sys -or $usb["$($p.DiskNumber)"]) { continue }
    $root = "$($l):\"
    if (Test-Path -LiteralPath "$($root)Windows\System32") { continue }
    $g = "$($p.GptType)".ToLower(); $m = [int]$p.MbrType
    $label = ''; $fs = ''
    try { $v = Get-Volume -Partition $p -ErrorAction Stop; $label = [string]$v.FileSystemLabel; $fs = [string]$v.FileSystem } catch {}
    $kind = $null
    if ($g -eq $EFI -or $m -eq 0xEF) { $kind = 'EFI' }
    elseif ($g -eq $MSR) { $kind = 'MSR' }
    elseif ($g -eq $REC -or $m -eq 0x27) { $kind = 'récupération' }
    elseif ($p.Size -lt 3GB) {
      if (Test-Path -LiteralPath "$($root)EFI\Microsoft\Boot\bootmgfw.efi") { $kind = 'EFI' }
      elseif (Test-Path -LiteralPath "$($root)Recovery\WindowsRE\Winre.wim") { $kind = 'récupération' }
      elseif ((Test-Path -LiteralPath "$($root)bootmgr") -or $label -match 'r.serv. au syst|syst.me r.serv|system reserved') { $kind = 'réservée au système' }
    }
    if ($kind) {
      [pscustomobject]@{ letter = "$($l):"; kind = $kind; disk = [int]$p.DiskNumber; part = [int]$p.PartitionNumber
        sizeMB = [math]::Round($p.Size / 1MB, 0); label = $label; fs = $fs }
    }
  }
}
`

// Retire la lettre de chaque partition trouvée : Remove-PartitionAccessPath,
// puis mountvol /D, puis diskpart « remove letter » (le seul qui passe à coup
// sûr sur la partition EFI). La lettre est vérifiée après chaque essai.
const sysPartsHidePS = sysPartsFindPS + `
function Has-Letter($x) { [IO.Directory]::GetLogicalDrives() -contains "$($x.letter)\" }
$f = @(Find-SysParts)
if ($f.Count -eq 0) { Write-Output "Aucune partition système avec une lettre de lecteur : rien à faire."; exit 0 }
$fail = 0
foreach ($x in $f) {
  $L = $x.letter.TrimEnd(':')
  Write-Output ("{0} partition {1} ({2} Mo{3}), disque {4} partition {5}" -f $x.letter, $x.kind, $x.sizeMB, $(if ($x.fs) { ', ' + $x.fs } else { '' }), $x.disk, $x.part)
  try { Remove-PartitionAccessPath -DiskNumber $x.disk -PartitionNumber $x.part -AccessPath "$($x.letter)\" -ErrorAction Stop } catch { Write-Output ("   Windows a refusé la première méthode : " + $_.Exception.Message) }
  if (Has-Letter $x) { & mountvol.exe "$($x.letter)" /D 2>&1 | Out-Null }
  if (Has-Letter $x) {
    $s = Join-Path $env:TEMP 'pc2diag_hidesys.txt'
    Set-Content -LiteralPath $s -Value @("select volume=$L", "remove letter=$L") -Encoding ASCII
    & diskpart.exe /s $s 2>&1 | Where-Object { $_ -match '\S' } | Select-Object -Last 2 | ForEach-Object { Write-Output ("   diskpart : " + "$_".Trim()) }
    Remove-Item -LiteralPath $s -ErrorAction SilentlyContinue
  }
  if (Has-Letter $x) { $fail++; Write-Output "   ÉCHEC : la lettre $($x.letter) est toujours là." } else { Write-Output "   Lettre $($x.letter) retirée : la partition est de nouveau cachée (rien n'a été effacé)." }
}
if ($fail) { Write-Output "$fail partition(s) encore visible(s) : essayez à la main avec diskpart (list volume, select volume, remove letter)."; exit 1 }
Write-Output "Terminé. Fermez et rouvrez l'Explorateur si les lecteurs y apparaissent encore."`
