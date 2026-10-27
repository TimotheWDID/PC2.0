{{-- Audit report for the client: summary, network and every device with the
     verdict and advice of its last diagnostic. Printable as PDF. --}}
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Audit - {{ $audit->client?->name }} - {{ $audit->title }}</title>
<style>
  *{box-sizing:border-box;}
  body{margin:0; padding:24px 12px; background:#eef1f0; font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif; color:#1d2624; font-size:13.5px; line-height:1.5; color-scheme:light;}
  body *{-webkit-print-color-adjust:exact; print-color-adjust:exact;}
  .paper{max-width:1000px; margin:0 auto; background:#fff; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,.08), 0 18px 40px -20px rgba(0,0,0,.35); padding:38px 38px 30px;}
  @media (max-width:700px){ body{padding:0;} .paper{padding:20px 16px; border-radius:0;} }
  .top{display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; padding-bottom:12px; border-bottom:2px solid #1c6e5c;}
  .top b{display:block; font-size:16px; color:#1c6e5c;}
  .muted{color:#7c8885; font-size:12px;}
  h1{font-size:23px; margin:20px 0 4px;}
  h2{font-size:13px; text-transform:uppercase; letter-spacing:.06em; color:#1c6e5c; margin:24px 0 10px;}
  .kpis{display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:8px;}
  .kpi{background:#f5f7f6; border-radius:10px; padding:10px 12px;}
  .kpi b{display:block; font-size:22px;}
  .kpi.crit b{color:#cc3333;} .kpi.warn b{color:#c27c00;} .kpi.good b{color:#0a8a0a;}
  .scroll{overflow-x:auto;}
  table{width:100%; border-collapse:collapse; font-size:12.5px;}
  th,td{text-align:left; padding:6px 8px; border-bottom:1px solid #e3e8e6; vertical-align:top;}
  th{color:#4a5653; font-weight:600; background:#f5f7f6;}
  tr{break-inside:avoid;}
  .pill{display:inline-block; padding:1px 8px; border-radius:999px; font-size:11.5px; font-weight:600; background:#e3e8e6; white-space:nowrap;}
  .pill.good{background:#e3f5e3; color:#0a8a0a;} .pill.warn{background:#fdf0d5; color:#c27c00;} .pill.crit{background:#fbe0e0; color:#cc3333;}
  ul.adv{margin:4px 0 0; padding-left:18px;}
  ul.adv li.urgent{color:#cc3333;} ul.adv li.reco{color:#c27c00;}
  .notes{white-space:pre-wrap; background:#f5f7f6; border-radius:10px; padding:10px 12px;}
  .print{position:fixed; right:16px; bottom:16px; padding:10px 16px; border:0; border-radius:8px; background:#1c6e5c; color:#fff; font-weight:600; cursor:pointer;}
  @media print{ body{background:#fff; padding:0;} .paper{box-shadow:none; padding:0;} .print{display:none;} }
</style>
</head>
<body>
<div class="paper">
  <div class="top">
    <div><b>{{ $shopName }}</b><span class="muted">Audit informatique</span></div>
    <div class="muted">{{ $date }}</div>
  </div>

  <h1>{{ $audit->title }}</h1>
  <div>
    Client : <b>{{ $audit->client?->name }}</b>@if($audit->site_name) · Site : <b>{{ $audit->site_name }}</b>@endif
    · Statut : {{ $statusLabel }}@if($audit->technician) · Technicien : {{ $audit->technician->name }}@endif
  </div>

  <h2>Synthèse</h2>
  <div class="kpis">
    <div class="kpi"><b>{{ $counts['devices'] }}</b>appareil(s)</div>
    <div class="kpi"><b>{{ $counts['diagnosed'] }}</b>diagnostiqué(s)</div>
    <div class="kpi crit"><b>{{ $counts['crit'] }}</b>en état critique</div>
    <div class="kpi warn"><b>{{ $counts['warn'] }}</b>à surveiller</div>
    <div class="kpi good"><b>{{ $counts['good'] }}</b>en bon état</div>
  </div>

  @if($audit->notes)
    <h2>Observations</h2>
    <div class="notes">{{ $audit->notes }}</div>
  @endif

  <h2>Parc informatique</h2>
  @if($rows->isEmpty())
    <p class="muted">Aucun appareil dans cet audit.</p>
  @else
    <div class="scroll"><table>
      <thead><tr><th>Appareil</th><th>Type</th><th>Emplacement / utilisateur</th><th>État</th><th>Recommandations</th></tr></thead>
      <tbody>
      @foreach($rows as $row)
        <tr>
          <td><b>{{ $row['name'] }}</b>@if($row['machine'] && $row['machine'] !== $row['name'])<br><span class="muted">{{ $row['machine'] }}</span>@endif @if($row['ip'])<br><span class="muted">{{ $row['ip'] }}</span>@endif</td>
          <td>{{ $row['kind'] }}</td>
          <td>{{ $row['location'] }}@if($row['location'] && $row['assigned_to']) · @endif{{ $row['assigned_to'] }}</td>
          <td>
            @if($row['overall'])
              <span class="pill {{ $row['overall'] }}">{{ $row['overall_label'] ?: ['good' => 'Bon état', 'warn' => 'À surveiller', 'crit' => 'Critique'][$row['overall']] }}</span>
              @if($row['score'] !== null)<br><span class="muted">Viabilité {{ $row['score'] }}/100</span>@endif
            @else
              <span class="muted">{{ $row['diagnosable'] ? 'Non diagnostiqué' : 'Inventorié' }}</span>
            @endif
          </td>
          <td>
            @if($row['advice'])
              <ul class="adv">@foreach($row['advice'] as $item)<li class="{{ $item['priority'] }}">{{ $item['title'] }}</li>@endforeach</ul>
            @endif
            @if($row['notes'])<div class="muted">{{ $row['notes'] }}</div>@endif
          </td>
        </tr>
      @endforeach
      </tbody>
    </table></div>
  @endif

  @if($scan)
    <h2>Réseau</h2>
    <p>
      Réseau {{ $scan->subnet ?: '—' }}@if($scan->gateway) · passerelle {{ $scan->gateway }}@endif @if($scan->dns) · DNS {{ $scan->dns }}@endif @if($scan->public_ip) · IP publique {{ $scan->public_ip }}@endif
      <br><span class="muted">{{ $scan->host_count }} équipement(s) détecté(s) le {{ $scan->created_at?->timezone('Europe/Paris')->format('d/m/Y à H:i') }}</span>
    </p>
    @php($withVendor = collect($scan->hosts ?? [])->contains(fn ($h) => ! empty($h['vendor'])))
    <div class="scroll"><table>
      <thead><tr><th>Adresse IP</th><th>Nom</th>@if($withVendor)<th>Fabricant</th>@endif<th>Type</th><th>Services</th></tr></thead>
      <tbody>
      @foreach(collect($scan->hosts ?? [])->sortBy(fn ($h) => ip2long($h['ip'] ?? '') ?: PHP_INT_MAX) as $host)
        <tr>
          <td>{{ $host['ip'] ?? '' }}</td>
          <td>{{ $host['hostname'] ?? '' }}</td>
          @if($withVendor)<td>{{ $host['vendor'] ?? '' }}</td>@endif
          <td>{{ \App\Models\AuditDevice::KINDS[$host['kind'] ?? ''] ?? '' }}@if(!empty($host['kind_hint']))<br><span class="muted">{{ $host['kind_hint'] }}</span>@endif</td>
          <td>{{ implode(', ', $host['ports'] ?? []) }}</td>
        </tr>
      @endforeach
      </tbody>
    </table></div>
  @endif
</div>
<button class="print" onclick="window.print()">Imprimer / PDF</button>
</body>
</html>
