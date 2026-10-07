<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RemoteSubscription extends Model
{
    public const STATUSES = ['active', 'suspended', 'ended'];

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
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function interventions(): HasMany
    {
        return $this->hasMany(RemoteIntervention::class);
    }

    public function isExpired(): bool
    {
        return $this->ends_on !== null && $this->ends_on->endOfDay()->isPast();
    }
}
