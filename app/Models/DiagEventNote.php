<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * What the technicians taught PC2 Diag about a Windows event it did not
 * know (source and number): explanation, likely causes and advice. Every
 * paired app downloads these notes, so they all share the same knowledge.
 */
class DiagEventNote extends Model
{
    public const SEVERITIES = ['crit', 'warn', 'info'];

    protected $fillable = [
        'source',
        'event_id',
        'sev',
        'noise',
        'title',
        'explain',
        'advice',
        'causes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'event_id' => 'integer',
        'noise' => 'boolean',
        'causes' => 'array',
    ];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * @return array<string, mixed> the note as the app and the site page read it
     */
    public function toPayload(): array
    {
        $name = fn (?User $user) => $user ? (trim(($user->first_name ?? '').' '.($user->last_name ?? '')) ?: $user->email) : null;

        return [
            'id' => $this->id,
            'source' => $this->source,
            'event_id' => $this->event_id,
            'sev' => $this->sev,
            'noise' => $this->noise,
            'title' => $this->title,
            'explain' => $this->explain,
            'advice' => $this->advice,
            'causes' => array_values($this->causes ?? []),
            'by' => $name($this->editor) ?? $name($this->author),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
