<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Diagnostic extends Model
{
    protected $fillable = [
        'ticket_id',
        'device_id',
        'technician_id',
        'machine_name',
        'overall',
        'overall_label',
        'viability_score',
        'viability_level',
        'viability_label',
        'report',
        'inventory',
        'state',
        'files',
    ];

    protected $casts = [
        'report' => 'array',
        'inventory' => 'array',
        'state' => 'array',
        'files' => 'array',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    public function storageDirectory(): string
    {
        return 'diagnostics/'.$this->id;
    }
}
