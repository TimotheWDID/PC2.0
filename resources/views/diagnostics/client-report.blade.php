{{-- Customer sheet of a diagnostic, as shared on the ticket. Mirrors the
     "Fiche client" of the Diag (resources/diag/diag-atelier.html): only the
     customer-facing part of the report, never the technical data. --}}
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{{ $title }}</title>
<style>
  *{box-sizing:border-box;}
  body{margin:0; padding:24px 12px; background:#eef1f0; font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;}
  .cd-paper{max-width:794px; margin:0 auto; background:#fff; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,.08), 0 18px 40px -20px rgba(0,0,0,.35); padding:38px 38px 30px;}
  @media (max-width:700px){ body{padding:0;} .cd-paper{padding:20px 16px; border-radius:0;} }
  .cdoc{
    --c-ink:#1d2624; --c-ink2:#4a5653; --c-muted:#7c8885; --c-line:#e3e8e6; --c-soft:#f5f7f6;
    --c-good:#0a8a0a; --c-good-bg:#e3f5e3; --c-warn:#c27c00; --c-warn-bg:#fdf0d5; --c-crit:#cc3333; --c-crit-bg:#fbe0e0; --c-info:#2a6fb0; --c-info-bg:#e3eef9;
    --c-accent:#1c6e5c;
    color:var(--c-ink); font-size:13.5px; line-height:1.5; color-scheme:light;
  }
  .cdoc *{-webkit-print-color-adjust:exact; print-color-adjust:exact;}
  .cd-top{display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; padding-bottom:12px; border-bottom:2px solid var(--c-accent);}
  .cd-shop b{display:block; font-size:16px; color:var(--c-accent);}
  .cd-shop span{font-size:12px; color:var(--c-ink2);}
  .cd-date{font-size:12px; color:var(--c-muted); white-space:nowrap; padding-top:3px;}
  .cd-title{font-size:23px; letter-spacing:-0.015em; margin:20px 0 4px;}
  .cd-machine{margin:0 0 16px; font-size:13px; color:var(--c-ink2);}
  .cd-machine b{color:var(--c-ink);}
  .cd-sec{margin-top:18px; break-inside:avoid;}
  .cd-h{font-size:13px; text-transform:uppercase; letter-spacing:.06em; color:var(--c-accent); margin:0 0 10px; font-weight:700;}
  .cd-h small{text-transform:none; letter-spacing:0; color:var(--c-muted); font-weight:500;}
  .dot{flex:none; width:14px; height:14px; border-radius:50%; margin-top:4px; background:var(--c-line);}
  .good > .dot{background:var(--c-good);} .warn > .dot{background:var(--c-warn);} .crit > .dot{background:var(--c-crit);}
  .cd-mood{display:flex; align-items:flex-start; gap:14px; padding:18px 20px; border-radius:14px; background:var(--c-soft);}
  .cd-mood .dot{width:22px; height:22px;}
  .cd-mood.good{background:var(--c-good-bg);} .cd-mood.warn{background:var(--c-warn-bg);} .cd-mood.crit{background:var(--c-crit-bg);}
  .cd-mood h2{font-size:19px; margin:0 0 4px;}
  .cd-mood p{margin:0; color:var(--c-ink2); font-size:14px;}
  .cd-bar{display:grid; grid-template-columns:45fr 25fr 30fr; border-radius:999px; overflow:hidden; font-size:11.5px; font-weight:700;}
  .cd-bar span{padding:6px 10px; text-align:center;}
  .cd-bar .crit{background:var(--c-crit-bg); color:var(--c-crit);}
  .cd-bar .warn{background:var(--c-warn-bg); color:var(--c-warn);}
  .cd-bar .good{background:var(--c-good-bg); color:var(--c-good);}
  .cd-marks{position:relative; height:40px;}
  .cd-mark{position:absolute; top:0; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; font-size:11.5px; white-space:nowrap;}
  .cd-mark::before{content:""; width:0; height:0; border-left:7px solid transparent; border-right:7px solid transparent; border-bottom:9px solid var(--c-ink); margin-top:3px;}
  .cd-mark b{margin-top:3px; padding:2px 8px; border-radius:6px; background:var(--c-ink); color:#fff; font-weight:600;}
  .cd-mark.after{top:28px;}
  .cd-marks.two{height:68px;}
  .cd-mark.after::before{border-bottom-color:var(--c-accent);}
  .cd-mark.after b{background:#fff; color:var(--c-accent); border:1.5px solid var(--c-accent);}
  .cd-tiles{display:grid; grid-template-columns:1fr 1fr; gap:8px;}
  @media (max-width:600px){ .cd-tiles{grid-template-columns:1fr;} }
  .cd-tile{display:flex; gap:10px; align-items:flex-start; padding:10px 12px; border-radius:10px; background:var(--c-soft); break-inside:avoid;}
  .cd-tile b{display:block; font-size:13.5px; margin-bottom:1px;}
  .cd-tile span{font-size:12.5px; color:var(--c-ink2); line-height:1.45;}
  .cd-advice{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:7px; counter-reset:adv;}
  .cd-advice li{display:flex; gap:12px; align-items:flex-start; padding:10px 12px; border:1px solid var(--c-line); border-radius:10px; break-inside:avoid; counter-increment:adv;}
  .cd-advice li::before{content:counter(adv); flex:none; width:24px; height:24px; border-radius:50%; background:var(--c-accent); color:#fff; font-weight:700; font-size:12.5px; display:flex; align-items:center; justify-content:center; margin-top:1px;}
  .cd-advice li > div{flex:1; min-width:0;}
  .cd-advice b{display:block; font-size:14px;}
  .cd-advice div span{font-size:12.5px; color:var(--c-ink2);}
  .cd-prio{order:2; flex:none; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; padding:3px 8px; border-radius:999px; margin-top:2px; white-space:nowrap;}
  .cd-advice li.crit .cd-prio{background:var(--c-crit-bg); color:var(--c-crit);}
  .cd-advice li.warn .cd-prio{background:var(--c-warn-bg); color:var(--c-warn);}
  .cd-advice li.good .cd-prio{background:var(--c-good-bg); color:var(--c-good);}
  .cd-advice li.info .cd-prio{background:var(--c-info-bg); color:var(--c-info);}
  .cd-none{margin:0; padding:12px 14px; border-radius:10px; background:var(--c-good-bg); color:var(--c-ink2);}
  .cd-notes{margin:0; white-space:pre-wrap; padding:12px 14px; border-radius:10px; background:var(--c-soft); font-style:italic; color:var(--c-ink2);}
  .cd-foot{margin-top:22px; padding-top:10px; border-top:1px solid var(--c-line); font-size:11.5px; color:var(--c-muted);}
  .cd-print{display:block; max-width:794px; margin:0 auto 12px; text-align:right;}
  .cd-print button{font:inherit; font-size:13px; padding:7px 14px; border-radius:8px; border:1px solid #c9d1ce; background:#fff; cursor:pointer;}
  @media print{
    @page{size:A4; margin:10mm;}
    body{padding:0; background:#fff;}
    .cd-paper{box-shadow:none; padding:0; max-width:none;}
    .cd-print{display:none;}
  }
</style>
</head>
<body>
<div class="cd-print"><button type="button" onclick="window.print()">Imprimer / enregistrer en PDF</button></div>
<div class="cd-paper">
  <article class="cdoc">
    <header class="cd-top">
      <div class="cd-shop"><b>{{ $shopName }}</b><span>Ticket n° {{ $ticketId }}</span></div>
      @if ($date)
        <div class="cd-date">Bilan du {{ $date }}</div>
      @endif
    </header>

    <h1 class="cd-title">Le bilan de santé de votre ordinateur</h1>
    <p class="cd-machine"><b>{{ $machine ?: 'Votre ordinateur' }}</b>@if ($machineLine) — {{ $machineLine }}@endif</p>

    <section class="cd-sec cd-mood {{ $verdict['level'] }}">
      <span class="dot"></span>
      <div><h2>{{ $verdict['title'] }}</h2>@if ($verdict['text'])<p>{{ $verdict['text'] }}</p>@endif</div>
    </section>

    @if ($scale)
      <section class="cd-sec">
        <h3 class="cd-h">Où en est votre ordinateur ?</h3>
        <div class="cd-bar"><span class="crit">À remplacer</span><span class="warn">À améliorer</span><span class="good">En forme</span></div>
        <div class="cd-marks{{ $scale['potential'] !== null ? ' two' : '' }}">
          <span class="cd-mark" style="left:{{ $scale['score'] }}%"><b>Aujourd’hui</b></span>
          @if ($scale['potential'] !== null)
            <span class="cd-mark after" style="left:{{ $scale['potential'] }}%"><b>Après nos conseils</b></span>
          @endif
        </div>
      </section>
    @endif

    @if ($details)
      <section class="cd-sec">
        <h3 class="cd-h">En détail</h3>
        <div class="cd-tiles">
          @foreach ($details as $tile)
            <div class="cd-tile {{ $tile['level'] }}"><span class="dot"></span><div><b>{{ $tile['title'] }}</b><span>{{ $tile['text'] }}</span></div></div>
          @endforeach
        </div>
      </section>
    @endif

    <section class="cd-sec">
      <h3 class="cd-h">Nos conseils</h3>
      @if ($advice)
        <ol class="cd-advice">
          @foreach ($advice as $item)
            <li class="{{ $item['level'] }}">@if ($item['label'])<span class="cd-prio">{{ $item['label'] }}</span>@endif<div><b>{{ $item['title'] }}</b>@if ($item['why'])<span>{{ $item['why'] }}</span>@endif</div></li>
          @endforeach
        </ol>
      @else
        <p class="cd-none">Rien à prévoir pour le moment : continuez simplement à faire les mises à jour proposées par Windows.</p>
      @endif
    </section>

    @if ($notes)
      <section class="cd-sec">
        <h3 class="cd-h">Le mot du technicien</h3>
        <p class="cd-notes">{{ $notes }}</p>
      </section>
    @endif

    <footer class="cd-foot">Ce bilan a été établi à partir de mesures et de tests réalisés sur votre ordinateur. Pour toute question, n’hésitez pas à nous répondre depuis votre ticket.</footer>
  </article>
</div>
</body>
</html>
