<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Support\Facades\Storage;

/**
 * Audit of a whole client (company or person): network scans run by PC2 Diag
 * on the client's LAN, the devices found there or added by hand, and the
 * PC2 Diag diagnostic of each computer.
 */
class Audit extends Model
{
    public const STATUSES = ['draft', 'in_progress', 'done'];

    public const STATUS_LABELS = ['draft' => 'En préparation', 'in_progress' => 'En cours', 'done' => 'Terminé'];

    protected $fillable = [
        'user_id',
        'technician_id',
        'title',
        'status',
        'site_name',
        'notes',
        'completed_at',
    ];

    protected $casts = [
        'completed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::saving(function (Audit $audit) {
            if ($audit->isDirty('status')) {
                $audit->completed_at = $audit->status === 'done' ? ($audit->completed_at ?? now()) : null;
            }
        });

        // The database drops the diagnostics with their audit; their files go here
        static::deleting(function (Audit $audit) {
            $audit->diagnostics()->get()->each(
                fn (Diagnostic $diagnostic) => Storage::disk('local')->deleteDirectory($diagnostic->storageDirectory())
            );
        });
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    public function devices(): HasMany
    {
        return $this->hasMany(AuditDevice::class);
    }

    public function networkScans(): HasMany
    {
        return $this->hasMany(AuditNetworkScan::class);
    }

    public function diagnostics(): HasManyThrough
    {
        return $this->hasManyThrough(Diagnostic::class, AuditDevice::class);
    }
}
