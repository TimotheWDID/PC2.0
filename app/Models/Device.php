<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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
        'ninjaone_device_id',
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
        'access_password',
        'no_access_password',
    ];

    protected $casts = [
        'purchase_date' => 'date',
        'warranty_start_date' => 'date',
        'warranty_end_date' => 'date',
        'access_password' => 'encrypted',
        'no_access_password' => 'boolean',
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

    /**
     * Accepts a NinjaOne device id or a pasted device URL
     * (".../#/deviceDashboard/123/overview") and keeps the id only.
     */
    public static function normalizeNinjaOneId(mixed $value): ?string
    {
        $value = trim((string) ($value ?? ''));
        if ($value === '') {
            return null;
        }

        if (preg_match('~deviceDashboard/(\d+)~i', $value, $matches)) {
            return $matches[1];
        }

        return $value;
    }

    public function getNinjaoneUrlAttribute(): ?string
    {
        if (! $this->ninjaone_device_id) {
            return null;
        }

        return rtrim((string) config('services.ninjaone.url'), '/').'/#/deviceDashboard/'.$this->ninjaone_device_id.'/overview';
    }

    public function remoteSubscriptions(): BelongsToMany
    {
        return $this->belongsToMany(RemoteSubscription::class)->withTimestamps();
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
