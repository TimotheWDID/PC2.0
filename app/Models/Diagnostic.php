<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Diagnostic extends Model
{
    /** Diag advice priority => colour of its label on the customer sheet. */
    private const ADVICE_LEVELS = ['urgent' => 'crit', 'reco' => 'warn', 'option' => 'good', 'info' => 'info'];

    protected $fillable = [
        'ticket_id',
        'device_id',
        'technician_id',
        'machine_name',
        'overall',
        'overall_label',
        'viability_score',
        'viability_level',
        'viability_label',
        'report',
        'inventory',
        'state',
        'files',
        'client_visible',
        'client_visible_at',
    ];

    protected $casts = [
        'report' => 'array',
        'inventory' => 'array',
        'state' => 'array',
        'files' => 'array',
        'client_visible' => 'boolean',
        'client_visible_at' => 'datetime',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    /** Name of the customer sheet as a ticket attachment. */
    public function clientReportName(): string
    {
        return 'Bilan diagnostic'.($this->created_at ? ' du '.$this->created_at->timezone('Europe/Paris')->format('d-m-Y') : '').'.html';
    }

    /**
     * The customer sheet as a standalone HTML page, built from the
     * customer-facing part of the report only (clientReport, notes).
     */
    public function clientReportHtml(): string
    {
        $report = is_array($this->report) ? $this->report : [];
        $client = is_array($report['clientReport'] ?? null) ? $report['clientReport'] : [];
        $verdict = is_array($client['verdict'] ?? null) ? $client['verdict'] : [];
        $viability = is_array($report['viability'] ?? null) ? $report['viability'] : [];
        $machine = is_array($report['machine'] ?? null) ? $report['machine'] : [];

        $scale = null;
        if (is_numeric($viability['score'] ?? null)) {
            $score = (float) $viability['score'];
            $potential = is_numeric($viability['potential'] ?? null) && (float) $viability['potential'] > $score
                ? (float) $viability['potential']
                : null;
            $scale = [
                'score' => self::clampPercent($score),
                'potential' => $potential !== null ? self::clampPercent($potential) : null,
            ];
        }

        $details = collect(is_array($client['details'] ?? null) ? $client['details'] : [])
            ->filter(fn ($tile) => is_array($tile) && self::plainText($tile['title'] ?? null) !== '')
            ->map(fn (array $tile) => [
                'level' => self::level($tile['status'] ?? null),
                'title' => self::plainText($tile['title']),
                'text' => self::plainText($tile['text'] ?? null),
            ])->values()->all();

        $advice = collect(is_array($client['advice'] ?? null) ? $client['advice'] : [])
            ->filter(fn ($item) => is_array($item) && self::plainText($item['title'] ?? null) !== '')
            ->map(fn (array $item) => [
                'level' => self::ADVICE_LEVELS[$item['priority'] ?? ''] ?? 'info',
                'label' => self::plainText($item['priorityLabel'] ?? null),
                'title' => self::plainText($item['title']),
                'why' => self::plainText($item['why'] ?? null),
            ])->values()->all();

        $date = $this->created_at?->copy()->timezone('Europe/Paris')->locale('fr')->translatedFormat('j F Y');

        return view('diagnostics.client-report', [
            'title' => 'Bilan de santé de votre ordinateur - Ticket '.$this->ticket_id,
            'shopName' => (string) config('app.name'),
            'ticketId' => $this->ticket_id,
            'date' => $date,
            'machine' => self::plainText($machine['name'] ?? $this->machine_name),
            'machineLine' => self::machineLine($report),
            'verdict' => [
                'level' => self::level($verdict['lvl'] ?? $this->overall),
                'title' => self::plainText($verdict['title'] ?? null) ?: ($this->overall_label ?: 'Bilan de votre ordinateur'),
                'text' => self::plainText($verdict['text'] ?? null),
            ],
            'scale' => $scale,
            'details' => $details,
            'advice' => $advice,
            'notes' => trim((string) (is_string($report['notes'] ?? null) ? $report['notes'] : '')),
        ])->render();
    }

    /** Same wording as clientMachineLine() in the Diag. */
    private static function machineLine(array $report): string
    {
        $os = is_string($report['machine']['os'] ?? null) ? $report['machine']['os'] : '';
        $os = preg_replace(['/^Microsoft\s*/', '/\s*\(x64\).*$/', '/\s*Build.*$/'], '', $os);
        $ram = is_numeric($report['memory']['totalGB'] ?? null) ? round((float) $report['memory']['totalGB']).' Go de mémoire' : '';
        $disks = collect(is_array($report['disks'] ?? null) ? $report['disks'] : [])
            ->filter(fn ($disk) => is_array($disk) && is_numeric($disk['capacityGB'] ?? null) && ! preg_match('/USB/i', (string) ($disk['interface'] ?? '')))
            ->map(fn (array $disk) => (($disk['type'] ?? null) === 'SSD' ? 'SSD ' : 'disque dur ').round((float) $disk['capacityGB']).' Go')
            ->implode(' + ');

        return implode(' · ', array_filter([trim((string) $os), $ram, $disks]));
    }

    private static function plainText(mixed $value): string
    {
        if (! is_scalar($value)) {
            return '';
        }

        return trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
    }

    private static function level(mixed $value): string
    {
        return in_array($value, ['good', 'warn', 'crit', 'info'], true) ? $value : '';
    }

    private static function clampPercent(float $value): float
    {
        return round(max(2, min(98, $value)), 1);
    }

    public function storageDirectory(): string
    {
        return 'diagnostics/'.$this->id;
    }
}
