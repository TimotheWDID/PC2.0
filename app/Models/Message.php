<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Message extends Model
{
    protected $fillable = [
        'ticket_id',
        'author_id',
        'content',
        'is_internal',
        'attachments',
        'notification_channel',
        'notification_status',
        'notification_error',
        'notified_at',
    ];

    protected $casts = [
        'is_internal' => 'boolean',
        'attachments' => 'array',
        'notified_at' => 'datetime',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /**
     * Uploaded file attachments. Distinct from the legacy `attachments` JSON
     * column above, which is unused (inherited from the original ticket
     * package and never populated in this app).
     */
    public function fileAttachments(): HasMany
    {
        return $this->hasMany(MessageAttachment::class);
    }
}
