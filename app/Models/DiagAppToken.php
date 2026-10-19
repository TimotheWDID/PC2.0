<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * Access key of the PC2 Diag Windows application. Only its SHA-256 is kept:
 * the clear key is shown once, when the technician pairs the app.
 */
class DiagAppToken extends Model
{
    public const PREFIX = 'pc2d_';

    protected $fillable = [
        'user_id',
        'name',
        'token_hash',
        'last_used_at',
        'last_used_ip',
        'last_machine',
    ];

    protected $hidden = ['token_hash'];

    protected $casts = [
        'last_used_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array{0: DiagAppToken, 1: string} the saved key and its clear value
     */
    public static function issue(User $user, string $name): array
    {
        $plain = self::PREFIX.Str::random(48);

        $token = self::create([
            'user_id' => $user->id,
            'name' => $name,
            'token_hash' => hash('sha256', $plain),
        ]);

        return [$token, $plain];
    }

    public static function findByPlain(string $plain): ?self
    {
        if (! str_starts_with($plain, self::PREFIX)) {
            return null;
        }

        return self::query()->where('token_hash', hash('sha256', $plain))->first();
    }
}
