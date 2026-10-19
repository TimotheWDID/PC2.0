@php
    $d = $report['data'] ?? [];
    $findings = collect($report['findings'] ?? [])->filter(fn ($f) => is_array($f));
    $levelOrder = ['crit' => 0, 'warn' => 1, 'info' => 2, 'ok' => 3];
    $findings = $findings->sortBy(fn ($f) => $levelOrder[$f['level'] ?? 'info'] ?? 9)->values();
    $levelLabel = ['crit' => 'Critique', 'warn' => 'À surveiller', 'info' => 'Info', 'ok' => 'OK'];
    $yes = fn ($v) => $v === null ? '—' : ($v ? 'Oui' : 'Non');
    $val = fn ($v, $suffix = '') => ($v === null || $v === '' || $v === []) ? '—' : (is_array($v) ? implode(', ', array_filter($v, 'is_scalar')) : $v.$suffix);
    $list = fn ($v) => is_array($v) ? array_values(array_filter($v, 'is_array')) : [];
    $meta = $d['meta'] ?? [];
    $title = $diagnostic->machine_name ?: ($report['machine']['name'] ?? 'Poste');
@endphp
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Diag {{ $title }}</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--ink:#16181d;--mute:#667085;--line:#e4e7ec;--good:#067647;--goodbg:#ecfdf3;--warn:#b54708;--warnbg:#fffaeb;--crit:#b42318;--critbg:#fef3f2;--info:#175cd3;--infobg:#eff8ff}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#171a21;--ink:#e6e8ec;--mute:#98a2b3;--line:#2a2f3a;--good:#47cd89;--goodbg:#0b2a1c;--warn:#fdb022;--warnbg:#2e2208;--crit:#f97066;--critbg:#2f0f0d;--info:#53b1fd;--infobg:#0b1f36}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:16px}
a{color:var(--info)}
header{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
h1{font-size:22px;margin:4px 0}
h2{font-size:16px;margin:0 0 10px}
.mute{color:var(--mute)}
.badge{display:inline-block;border:1px solid currentColor;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600;margin-right:6px}
.good{color:var(--good);background:var(--goodbg)}.warn{color:var(--warn);background:var(--warnbg)}.crit{color:var(--crit);background:var(--critbg)}.info,.ok{color:var(--info);background:var(--infobg)}
.ok{color:var(--good);background:var(--goodbg)}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.grid .card{margin-bottom:0}
.finding{border-left:4px solid currentColor;padding:8px 12px;border-radius:6px;margin-bottom:8px}
.finding b{color:var(--ink)}
.finding p{margin:2px 0;color:var(--ink)}
.finding .adv{color:var(--mute);font-size:13px}
dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;margin:0}
dt{color:var(--mute)}dd{margin:0;word-break:break-word}
.tbl{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--mute);font-weight:600}
details summary{cursor:pointer;font-weight:600}
.btn{display:inline-block;padding:6px 12px;border:1px solid var(--line);border-radius:8px;text-decoration:none;color:var(--ink);background:var(--card)}
@media print{.noprint{display:none}body{background:#fff}}
</style>
</head>
<body>
<div class="wrap">
<header>
    <div>
        <div class="noprint"><a class="btn" href="{{ $backUrl }}">← {{ $backLabel }}</a></div>
        <h1>{{ $title }}</h1>
        <div class="mute">
            Diagnostic de l'application PC2 Diag
            @if ($diagnostic->created_at) · {{ $diagnostic->created_at->timezone(config('app.timezone'))->format('d/m/Y H:i') }} @endif
            @if ($technician) · {{ $technician }} @endif
            @if (!empty($report['version'])) · v{{ $report['version'] }} @endif
        </div>
    </div>
    <div>
        @if ($diagnostic->overall_label)
            <span class="badge {{ $diagnostic->overall }}">{{ $diagnostic->overall_label }}</span>
        @endif
        @if ($diagnostic->viability_score !== null)
            <span class="badge {{ $diagnostic->viability_level }}">Viabilité {{ $diagnostic->viability_score }}/100</span>
        @endif
        <div class="noprint" style="margin-top:8px;text-align:right"><a class="btn" href="javascript:window.print()">Imprimer</a></div>
    </div>
</header>

@if ($diagnostic->viability_label)
    <p><b>{{ $diagnostic->viability_label }}</b></p>
@endif

<section class="card">
    <h2>Constats ({{ $findings->whereIn('level', ['crit', 'warn'])->count() }} à traiter)</h2>
    @forelse ($findings as $f)
        <div class="finding {{ $f['level'] ?? 'info' }}">
            <b>{{ $f['title'] ?? '' }}</b>
            <span class="badge {{ $f['level'] ?? 'info' }}" style="margin-left:6px">{{ $levelLabel[$f['level'] ?? 'info'] ?? 'Info' }}</span>
            @if (!empty($f['category']))<span class="mute">{{ $f['category'] }}</span>@endif
            @if (!empty($f['detail']))<p>{{ $f['detail'] }}</p>@endif
            @if (!empty($f['advice']))<p class="adv">{{ $f['advice'] }}</p>@endif
        </div>
    @empty
        <p class="mute">Aucun constat.</p>
    @endforelse
</section>

@php $actions = $list($report['actions'] ?? []); @endphp
@if ($actions)
    <section class="card">
        <h2>Réparations lancées par l'application</h2>
        <table>
            @foreach ($actions as $a)
                <tr>
                    <td>{{ $a['title'] ?? ($a['id'] ?? '') }}</td>
                    <td>{{ !empty($a['ok']) ? 'Terminée' : 'Échec ou annulée' }}@if (!empty($a['at'])) · {{ rescue(fn () => \Illuminate\Support\Carbon::parse($a['at'])->timezone(config('app.timezone'))->format('d/m/Y H:i'), '', false) }}@endif</td>
                </tr>
            @endforeach
        </table>
    </section>
@endif

<div class="grid">
    <section class="card">
        <h2>Système</h2>
        <dl>
            <dt>Nom</dt><dd>{{ $val($meta['computer'] ?? null) }}</dd>
            <dt>Fabricant</dt><dd>{{ $val($meta['manufacturer'] ?? null) }}</dd>
            <dt>Modèle</dt><dd>{{ $val($meta['model'] ?? null) }}</dd>
            <dt>N° de série</dt><dd>{{ $val($meta['serial'] ?? null) }}</dd>
            <dt>Carte mère</dt><dd>{{ $val($meta['board'] ?? null) }}</dd>
            <dt>BIOS</dt><dd>{{ $val($meta['bios'] ?? null) }} {{ !empty($meta['biosDate']) ? '('.substr($meta['biosDate'], 0, 10).')' : '' }}</dd>
            <dt>Windows</dt><dd>{{ $val($meta['os'] ?? null) }} {{ $meta['displayVersion'] ?? '' }} (build {{ $meta['build'] ?? '?' }}{{ isset($meta['ubr']) ? '.'.$meta['ubr'] : '' }})</dd>
            <dt>Installé le</dt><dd>{{ !empty($meta['installDate']) ? substr($meta['installDate'], 0, 10) : '—' }}</dd>
            <dt>Allumé depuis</dt><dd>{{ $val($meta['uptimeDays'] ?? null, ' j') }}</dd>
            <dt>Utilisateur</dt><dd>{{ $val($meta['user'] ?? null) }} {{ isset($meta['isAdmin']) ? '('.($meta['isAdmin'] ? 'admin' : 'non admin').')' : '' }}</dd>
            <dt>Domaine</dt><dd>{{ $val($meta['domain'] ?? null) }}</dd>
            <dt>Plan d'alimentation</dt><dd>{{ $val($d['power'] ?? null) }}</dd>
        </dl>
    </section>

    <section class="card">
        <h2>Processeur et mémoire</h2>
        <dl>
            <dt>Processeur</dt><dd>{{ $val($d['cpu']['name'] ?? null) }}</dd>
            <dt>Cœurs / threads</dt><dd>{{ $val($d['cpu']['cores'] ?? null) }} / {{ $val($d['cpu']['threads'] ?? null) }}</dd>
            <dt>Fréquence max</dt><dd>{{ $val($d['cpu']['maxMHz'] ?? null, ' MHz') }}</dd>
            <dt>Charge</dt><dd>{{ $val($d['cpu']['load'] ?? null, ' %') }}</dd>
            <dt>RAM</dt><dd>{{ $val($d['mem']['totalGB'] ?? null, ' Go') }} ({{ $val($d['mem']['usedPct'] ?? null, ' % utilisés') }})</dd>
            <dt>Emplacements</dt><dd>{{ count($list($d['mem']['modules'] ?? [])) }} barrette(s) / {{ $val($d['mem']['slots'] ?? null) }}</dd>
            @foreach ($list($d['mem']['modules'] ?? []) as $m)
                <dt>{{ $m['slot'] ?? 'Barrette' }}</dt><dd>{{ $val($m['sizeGB'] ?? null, ' Go') }} · {{ $val($m['speed'] ?? null, ' MHz') }} · {{ trim(($m['maker'] ?? '').' '.($m['part'] ?? '')) ?: '—' }}</dd>
            @endforeach
            @foreach ($list($d['gpu'] ?? []) as $g)
                <dt>Carte graphique</dt><dd>{{ $val($g['name'] ?? null) }} @if (!empty($g['driver']))<span class="mute">(pilote {{ $g['driver'] }})</span>@endif</dd>
            @endforeach
            @foreach ($list($d['thermal'] ?? []) as $t)
                <dt>Température {{ $t['zone'] ?? '' }}</dt><dd>{{ $val($t['c'] ?? null, ' °C') }}</dd>
            @endforeach
        </dl>
    </section>
</div>
<br>

<section class="card">
    <h2>Disques</h2>
    <div class="tbl"><table>
        <tr><th>Disque</th><th>Type</th><th>Taille</th><th>Santé</th><th>Usure</th><th>Temp.</th><th>Heures</th><th>Erreurs L/E</th></tr>
        @forelse ($list($d['disks'] ?? []) as $k)
            <tr>
                <td>{{ $val($k['name'] ?? null) }}<br><span class="mute">{{ $k['serial'] ?? '' }}</span></td>
                <td>{{ trim(($k['media'] ?? '').' '.($k['bus'] ?? '')) ?: '—' }}</td>
                <td>{{ $val($k['sizeGB'] ?? null, ' Go') }}</td>
                <td>{{ $val($k['health'] ?? null) }}</td>
                <td>{{ $val($k['wear'] ?? null, ' %') }}</td>
                <td>{{ $val($k['temp'] ?? null, ' °C') }}</td>
                <td>{{ $val($k['hours'] ?? null) }}</td>
                <td>{{ $val($k['readErr'] ?? null) }} / {{ $val($k['writeErr'] ?? null) }}</td>
            </tr>
        @empty
            <tr><td colspan="8" class="mute">Aucun disque relevé.</td></tr>
        @endforelse
    </table></div>
    <div class="tbl" style="margin-top:12px"><table>
        <tr><th>Volume</th><th>Système de fichiers</th><th>Taille</th><th>Libre</th><th>BitLocker</th></tr>
        @foreach ($list($d['volumes'] ?? []) as $v)
            <tr>
                <td>{{ $v['letter'] ?? '' }} {{ $v['label'] ?? '' }}</td>
                <td>{{ $val($v['fs'] ?? null) }}</td>
                <td>{{ $val($v['sizeGB'] ?? null, ' Go') }}</td>
                <td>{{ $val($v['freeGB'] ?? null, ' Go') }} ({{ $val($v['freePct'] ?? null, ' %') }})</td>
                <td>{{ $val($v['bitlocker'] ?? null) }}</td>
            </tr>
        @endforeach
    </table></div>
</section>

<div class="grid">
    <section class="card">
        <h2>Batterie</h2>
        @if (!empty($d['battery']['present']))
            <dl>
                <dt>Batterie</dt><dd>{{ $val($d['battery']['name'] ?? null) }}</dd>
                <dt>Charge</dt><dd>{{ $val($d['battery']['charge'] ?? null, ' %') }}</dd>
                <dt>Capacité d'origine</dt><dd>{{ $val($d['battery']['design'] ?? null, ' mWh') }}</dd>
                <dt>Capacité actuelle</dt><dd>{{ $val($d['battery']['full'] ?? null, ' mWh') }}</dd>
                <dt>Usure</dt><dd>{{ $val($d['battery']['wearPct'] ?? null, ' %') }}</dd>
                <dt>Cycles</dt><dd>{{ $val($d['battery']['cycles'] ?? null) }}</dd>
            </dl>
        @else
            <p class="mute">Pas de batterie (poste fixe).</p>
        @endif
    </section>

    <section class="card">
        <h2>Réseau</h2>
        <dl>
            <dt>Passerelle</dt><dd>{{ $val($d['network']['gateway'] ?? null) }} ({{ $yes($d['network']['gwPing'] ?? null) }})</dd>
            <dt>DNS</dt><dd>{{ $yes($d['network']['dns'] ?? null) }} <span class="mute">{{ $val($d['network']['dnsServers'] ?? null) }}</span></dd>
            <dt>Internet</dt><dd>{{ $yes($d['network']['internet'] ?? null) }}</dd>
            <dt>Adresses IP</dt><dd>{{ $val($d['network']['ip'] ?? null) }}</dd>
            @if (!empty($d['network']['wifi']['ssid']))
                <dt>Wi-Fi</dt><dd>{{ $d['network']['wifi']['ssid'] }} ({{ $val($d['network']['wifi']['signal'] ?? null, ' %') }})</dd>
            @endif
            @foreach ($list($d['network']['adapters'] ?? []) as $a)
                <dt>{{ $a['name'] ?? 'Carte' }}</dt><dd>{{ $val($a['desc'] ?? null) }} · {{ $val($a['status'] ?? null) }} {{ $a['speed'] ?? '' }}</dd>
            @endforeach
        </dl>
    </section>

    <section class="card">
        <h2>Sécurité</h2>
        @php $s = $d['security'] ?? []; @endphp
        <dl>
            @foreach ($list($s['av'] ?? []) as $av)
                <dt>Antivirus</dt><dd>{{ $av['name'] ?? '' }} ({{ !empty($av['enabled']) ? 'actif' : 'inactif' }}{{ array_key_exists('upToDate', $av) ? ', '.($av['upToDate'] ? 'à jour' : 'pas à jour') : '' }})</dd>
            @endforeach
            <dt>Defender temps réel</dt><dd>{{ $yes($s['defender']['rtp'] ?? null) }}</dd>
            <dt>Pare-feu</dt><dd>{{ collect($list($s['firewall'] ?? []))->map(fn ($f) => ($f['profile'] ?? '?').' '.(!empty($f['enabled']) ? 'actif' : 'INACTIF'))->implode(', ') ?: '—' }}</dd>
            <dt>Secure Boot</dt><dd>{{ $yes($s['secureBoot'] ?? null) }}</dd>
            <dt>TPM</dt><dd>{{ isset($s['tpm']['present']) ? ($s['tpm']['present'] ? 'Présent'.(!empty($s['tpm']['ready']) ? ', prêt' : ', non prêt') : 'Absent') : '—' }}</dd>
            <dt>UAC</dt><dd>{{ isset($s['uac']) ? ((int) $s['uac'] === 1 ? 'Actif' : 'Désactivé') : '—' }}</dd>
            <dt>SMBv1</dt><dd>{{ $yes($s['smb1'] ?? null) }}</dd>
            <dt>Bureau à distance</dt><dd>{{ $yes($s['rdp'] ?? null) }}</dd>
            <dt>Ouverture auto.</dt><dd>{{ $yes($s['autologon'] ?? null) }}</dd>
            <dt>Administrateurs</dt><dd>{{ $val($s['admins'] ?? null) }}</dd>
        </dl>
    </section>

    <section class="card">
        <h2>Stabilité (30 jours)</h2>
        @php $e = $d['events'] ?? []; @endphp
        <dl>
            <dt>Indice de fiabilité</dt><dd>{{ $val($d['reliability'] ?? null, ' / 10') }}</dd>
            <dt>Écrans bleus</dt><dd>{{ count($list($e['bsod'] ?? [])) }}</dd>
            <dt>Arrêts brutaux</dt><dd>{{ $val($e['kernelPower41'] ?? null) }}</dd>
            <dt>Erreurs matérielles (WHEA)</dt><dd>{{ $val($e['whea'] ?? null) }}</dd>
            <dt>Erreurs disque / NTFS</dt><dd>{{ $val($e['disk'] ?? null) }} / {{ $val($e['ntfs'] ?? null) }}</dd>
            <dt>Plantages d'applis</dt><dd>{{ $val($e['appCrashTotal'] ?? null) }}</dd>
            <dt>Dernière MAJ réussie</dt><dd>{{ !empty($d['updates']['lastSuccess']) ? substr($d['updates']['lastSuccess'], 0, 10) : '—' }}</dd>
            <dt>Redémarrage en attente</dt><dd>{{ $yes($d['updates']['rebootPending'] ?? null) }}</dd>
            <dt>Image Windows (DISM)</dt><dd>{{ $val($d['dism'] ?? null) }}</dd>
        </dl>
        @foreach ($list($e['bsod'] ?? []) as $b)
            <p class="mute" style="margin:6px 0 0">{{ substr($b['date'] ?? '', 0, 10) }} · {{ $b['code'] ?? '' }}</p>
        @endforeach
    </section>
</div>
<br>

@if ($list($d['devices'] ?? []))
<section class="card">
    <h2>Périphériques en erreur</h2>
    <div class="tbl"><table>
        <tr><th>Périphérique</th><th>Classe</th><th>Code</th></tr>
        @foreach ($list($d['devices']) as $p)
            <tr><td>{{ $p['name'] ?? '' }}</td><td>{{ $p['cls'] ?? '' }}</td><td>{{ $p['code'] ?? '' }}</td></tr>
        @endforeach
    </table></div>
</section>
@endif

<section class="card">
    <details>
        <summary>Programmes au démarrage ({{ count($list($d['startup'] ?? [])) }}) et services arrêtés ({{ count($list($d['services'] ?? [])) }})</summary>
        <div class="tbl"><table>
            @foreach ($list($d['startup'] ?? []) as $st)
                <tr><td>{{ $st['name'] ?? '' }}</td><td class="mute">{{ $st['cmd'] ?? '' }}</td></tr>
            @endforeach
            @foreach ($list($d['services'] ?? []) as $sv)
                <tr><td>Service arrêté : {{ $sv['display'] ?? $sv['name'] ?? '' }}</td><td class="mute">code {{ $sv['exit'] ?? '' }}</td></tr>
            @endforeach
        </table></div>
    </details>
</section>

<section class="card">
    <details>
        <summary>Logiciels installés ({{ count($list($d['software'] ?? [])) }})</summary>
        <div class="tbl"><table>
            <tr><th>Nom</th><th>Version</th><th>Éditeur</th></tr>
            @foreach ($list($d['software'] ?? []) as $sw)
                <tr><td>{{ $sw['name'] ?? '' }}</td><td>{{ $sw['version'] ?? '' }}</td><td>{{ $sw['publisher'] ?? '' }}</td></tr>
            @endforeach
        </table></div>
    </details>
</section>

@if ($list($d['errors'] ?? []))
<section class="card">
    <details>
        <summary>Relevés non disponibles ({{ count($list($d['errors'])) }})</summary>
        <ul>
            @foreach ($list($d['errors']) as $err)
                <li><b>{{ $err['check'] ?? '' }}</b> <span class="mute">{{ $err['msg'] ?? '' }}</span></li>
            @endforeach
        </ul>
    </details>
</section>
@endif
</div>
</body>
</html>
