<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RemoteIntervention extends Model
{
    protected $fillable = [
        'remote_subscription_id',
        'technician_id',
        'ticket_id',
        'performed_at',
        'duration_minutes',
        'description',
    ];

    protected $casts = [
        'performed_at' => 'datetime',
        'duration_minutes' => 'integer',
    ];

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(RemoteSubscription::class, 'remote_subscription_id');
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }
}
