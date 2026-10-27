<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Network scan of the client's LAN, run by PC2 Diag from one of its PCs.
 * Each host: ip, mac, hostname, vendor, ports (open TCP ports), kind (guessed).
 */
class AuditNetworkScan extends Model
{
    protected $fillable = [
        'audit_id',
        'technician_id',
        'machine_name',
        'subnet',
        'local_ip',
        'gateway',
        'dns',
        'public_ip',
        'duration_ms',
        'host_count',
        'hosts',
    ];

    protected $casts = [
        'hosts' => 'array',
        'duration_ms' => 'integer',
        'host_count' => 'integer',
    ];

    public function audit(): BelongsTo
    {
        return $this->belongsTo(Audit::class);
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }
}
