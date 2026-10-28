<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * A device of an audit: a computer diagnosed with PC2 Diag, or any equipment
 * of the network (printer, NAS, router…) found by a scan or added by hand.
 * A diagnosed computer is also linked to the client's device sheet.
 */
class AuditDevice extends Model
{
    public const KINDS = [
        'computer' => 'Ordinateur',
        'laptop' => 'Ordinateur portable',
        'server' => 'Serveur',
        'printer' => 'Imprimante',
        'nas' => 'NAS / stockage',
        'router' => 'Routeur / box',
        'switch' => 'Switch',
        'access_point' => 'Borne Wi-Fi',
        'camera' => 'Caméra',
        'phone' => 'Téléphone',
        'tablet' => 'Tablette',
        'other' => 'Autre',
    ];

    public const STATUSES = ['todo' => 'À diagnostiquer', 'done' => 'Diagnostiqué', 'skipped' => 'Ignoré'];

    /** Kinds that PC2 Diag can diagnose. */
    public const DIAGNOSABLE = ['computer', 'laptop', 'server'];

    protected $fillable = [
        'audit_id',
        'device_id',
        'kind',
        'name',
        'hostname',
        'ip',
        'mac',
        'serial_number',
        'location',
        'assigned_to',
        'status',
        'source',
        'open_ports',
        'notes',
    ];

    protected $casts = [
        'open_ports' => 'array',
    ];

    public function audit(): BelongsTo
    {
        return $this->belongsTo(Audit::class);
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }

    public function diagnostics(): HasMany
    {
        return $this->hasMany(Diagnostic::class);
    }

    public function latestDiagnostic(): HasOne
    {
        return $this->hasOne(Diagnostic::class)->latestOfMany();
    }

    public static function normalizeMac(mixed $value): ?string
    {
        $hex = strtoupper(preg_replace('/[^0-9a-fA-F]/', '', (string) ($value ?? '')));

        return strlen($hex) === 12 ? implode(':', str_split($hex, 2)) : null;
    }
}
