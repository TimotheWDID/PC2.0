<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TicketStat extends Model
{
    protected $table = 'tickets_stats';

    protected $fillable = [
        'user_id',
        'total_tickets',
        'average_resolution_time',
        'average_replies_per_ticket',
    ];

    protected $casts = [
        'total_tickets' => 'integer',
        'average_resolution_time' => 'float',
        'average_replies_per_ticket' => 'float',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
