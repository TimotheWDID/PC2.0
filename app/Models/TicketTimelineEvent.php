<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class TicketTimelineEvent extends Model
{
    use SoftDeletes;

    protected $touches = [
        'ticket',
    ];

    protected $fillable = [
        'ticket_id',
        'technician_id',
        'removed_by_id',
        'removed_reason',
        'removed_at',
        'restored_by_id',
        'restored_at',
        'event_type',
        'summary',
        'details',
        'happened_at',
    ];

    protected $casts = [
        'details' => 'array',
        'happened_at' => 'datetime',
        'removed_at' => 'datetime',
        'restored_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    public function removedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'removed_by_id');
    }

    public function restoredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'restored_by_id');
    }
}
