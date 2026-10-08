<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TicketFile extends Model
{
    public const VISIBILITY_INTERNAL = 'internal';

    public const VISIBILITY_EXTERNAL = 'external';

    public const VISIBILITIES = [self::VISIBILITY_INTERNAL, self::VISIBILITY_EXTERNAL];

    protected $fillable = [
        'ticket_id',
        'uploaded_by',
        'path',
        'original_name',
        'mime_type',
        'size',
        'visibility',
        'last_sent_at',
        'last_sent_to',
    ];

    protected function casts(): array
    {
        return [
            'size' => 'integer',
            'last_sent_at' => 'datetime',
        ];
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function isExternal(): bool
    {
        return $this->visibility === self::VISIBILITY_EXTERNAL;
    }
}
