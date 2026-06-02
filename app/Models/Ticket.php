<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use App\Models\User;
use App\Models\Category;
use App\Models\Device;
use App\Models\Message;
use App\Models\Label;
use App\Models\TicketTimelineEvent;

class Ticket extends Model
{
    protected $fillable = [
        'uuid',
        'user_id',
        'device_id',
        'invoice_id',
        'title',
        'message',
        'ticket_kind',
        'priority',
        'status',
        'category_id',
        'assignee_id',
        'notify_by',
        'contact_phone',
        'contact_email',
        'is_resolved',
        'is_locked',
    ];

    protected $casts = [
        'is_resolved' => 'boolean',
        'is_locked' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class, 'device_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function timelineEvents(): HasMany
    {
        return $this->hasMany(TicketTimelineEvent::class);
    }

    public function labels(): BelongsToMany
    {
        return $this->belongsToMany(Label::class, 'label_ticket');
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'category_ticket');
    }
}
