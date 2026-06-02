<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Device extends Model
{
    protected $fillable = [
        'user_id',
        'device_type',
        'brand',
        'model',
        'serial_number',
        'asset_tag',
        'purchase_date',
        'warranty_start_date',
        'warranty_end_date',
        'vendor_name',
        'status',
        'imei',
        'sim_number',
        'phone_number',
        'os_name',
        'ram_gb',
        'storage_gb',
        'cpu',
        'notes',
    ];

    protected $casts = [
        'purchase_date' => 'date',
        'warranty_start_date' => 'date',
        'warranty_end_date' => 'date',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(DeviceEvent::class);
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class);
    }

    public function getDisplayNameAttribute(): string
    {
        $brand = trim((string) ($this->brand ?? ''));
        $model = trim((string) ($this->model ?? ''));
        $serial = trim((string) ($this->serial_number ?? ''));

        $name = trim($brand . ' ' . $model);
        if ($name === '') {
            $name = ucfirst((string) $this->device_type);
        }

        return $serial !== '' ? $name . ' (' . $serial . ')' : $name;
    }
}
