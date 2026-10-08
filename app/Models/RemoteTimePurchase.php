<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RemoteTimePurchase extends Model
{
    protected $fillable = [
        'remote_subscription_id',
        'recorded_by',
        'purchased_on',
        'minutes',
        'price',
        'note',
    ];

    protected $casts = [
        'purchased_on' => 'date',
        'minutes' => 'integer',
        'price' => 'decimal:2',
    ];

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(RemoteSubscription::class, 'remote_subscription_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
