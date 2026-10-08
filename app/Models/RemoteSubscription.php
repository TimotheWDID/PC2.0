<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RemoteSubscription extends Model
{
    public const STATUSES = ['active', 'suspended', 'ended'];

    // Formules vendues : 1 an pour un appareil de base
    public const PLANS = [
        'NinjaOne - SECURITE',
        'NinjaOne - STANDARD',
        'NinjaOne - ESSENTIEL',
        'NinjaOne - PROFESSIONEL',
    ];

    public const EXPIRY_ALERT_DAYS = 30;

    protected $fillable = [
        'user_id',
        'plan',
        'status',
        'started_on',
        'ends_on',
        'included_minutes',
        'price',
        'devices_count',
        'ninjaone_reference',
        'notes',
    ];

    protected $casts = [
        'started_on' => 'date',
        'ends_on' => 'date',
        'included_minutes' => 'integer',
        'devices_count' => 'integer',
        'price' => 'decimal:2',
        'expiry_notified_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        // A renewed or corrected end date must trigger a fresh expiry alert
        static::saving(function (RemoteSubscription $subscription) {
            if ($subscription->isDirty('ends_on')) {
                $subscription->expiry_notified_at = null;
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function interventions(): HasMany
    {
        return $this->hasMany(RemoteIntervention::class);
    }

    public function daysLeft(): ?int
    {
        if ($this->ends_on === null) {
            return null;
        }

        return (int) now()->startOfDay()->diffInDays($this->ends_on->copy()->startOfDay(), false);
    }

    public function isExpired(): bool
    {
        return $this->ends_on !== null && $this->ends_on->endOfDay()->isPast();
    }
}
