<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InboundEmail extends Model
{
    public const HUMAN_REVIEW_STATUSES = [
        'skipped_ambiguous_ticket',
        'skipped_no_matching_ticket',
        'skipped_ticket_not_found',
        'skipped_no_ticket_reference',
        'skipped_sender_mismatch',
    ];

    protected $fillable = [
        'mailbox_uid',
        'message_id',
        'ticket_id',
        'sender_email',
        'subject',
        'body_text',
        'status',
        'error',
        'received_at',
        'processed_at',
    ];

    protected $casts = [
        'received_at' => 'datetime',
        'processed_at' => 'datetime',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function scopePendingHumanReview($query)
    {
        return $query
            ->whereNull('ticket_id')
            ->whereIn('status', self::HUMAN_REVIEW_STATUSES);
    }
}
