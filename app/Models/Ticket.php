<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Facades\Crypt;
use App\Models\User;
use App\Models\Category;
use App\Models\Device;
use App\Models\Message;
use App\Models\Label;
use App\Models\TicketTimelineEvent;

class Ticket extends Model
{
    private const MAGIC_TOKEN_REGEX = '/^(?:[a-f0-9]{64}|[A-Za-z0-9_-]{43}|[A-Za-z0-9_-]{22})$/';

    private const SPECIAL_CATEGORY_NAMES = [
        'Bug',
        'Amelioration',
    ];

    protected $fillable = [
        'uuid',
        'user_id',
        'device_id',
        'invoice_id',
        'title',
        'message',
        'device_password',
        'no_device_password',
        'ticket_kind',
        'priority',
        'status',
        'category_id',
        'assignee_id',
        'notify_by',
        'contact_phone',
        'contact_email',
        'creation_notification_channel',
        'creation_notification_status',
        'creation_notification_error',
        'creation_notified_at',
        'is_resolved',
        'is_locked',
        'ticket_token_hash',
        'ticket_token_encrypted',
        'token_expires_at',
    ];

    protected $casts = [
        'device_password' => 'encrypted',
        'no_device_password' => 'boolean',
        'is_resolved' => 'boolean',
        'is_locked' => 'boolean',
        'creation_notified_at' => 'datetime',
        'token_expires_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (Ticket $ticket): void {
            if (empty($ticket->ticket_token_hash) || empty($ticket->ticket_token_encrypted)) {
                $token = self::generateMagicToken();
                $ticket->ticket_token_hash = self::hashMagicToken($token);
                $ticket->ticket_token_encrypted = Crypt::encryptString($token);
            }

            $ticket->applyMagicTokenExpirationPolicy();
        });

        static::saving(function (Ticket $ticket): void {
            $ticket->applyMagicTokenExpirationPolicy();
        });
    }

    public static function generateMagicToken(): string
    {
        // 16 random bytes encoded in URL-safe base64 without padding => 22 chars.
        return rtrim(strtr(base64_encode(random_bytes(16)), '+/', '-_'), '=');
    }

    public static function looksLikeMagicToken(string $token): bool
    {
        return (bool) preg_match(self::MAGIC_TOKEN_REGEX, trim($token));
    }

    public static function hashMagicToken(string $token): string
    {
        return hash('sha256', trim($token));
    }

    public static function findByMagicToken(string $token): ?self
    {
        $hashedToken = self::hashMagicToken($token);

        return self::query()
            ->where('ticket_token_hash', $hashedToken)
            ->where(function (Builder $query) {
                $query
                    ->whereNull('token_expires_at')
                    ->orWhere('token_expires_at', '>', now());
            })
            ->first();
    }

    public function issueMagicLink(bool $forceRotate = false): array
    {
        return $this->getOrCreateMagicLink($forceRotate);
    }

    public function getOrCreateMagicLink(bool $forceRotate = false): array
    {
        if (! $forceRotate) {
            $existingToken = $this->getStoredMagicToken();

            if ($existingToken !== null) {
                return [
                    'token' => $existingToken,
                    'url' => $this->buildMagicLinkUrl($existingToken),
                ];
            }
        }

        $token = self::generateMagicToken();

        $this->forceFill([
            'ticket_token_hash' => self::hashMagicToken($token),
            'ticket_token_encrypted' => Crypt::encryptString($token),
        ])->save();

        return [
            'token' => $token,
            'url' => $this->buildMagicLinkUrl($token),
        ];
    }

    private function getStoredMagicToken(): ?string
    {
        $encrypted = (string) ($this->ticket_token_encrypted ?? '');
        if ($encrypted === '') {
            return null;
        }

        try {
            $token = trim(Crypt::decryptString($encrypted));
        } catch (\Throwable $exception) {
            return null;
        }

        if (! self::looksLikeMagicToken($token)) {
            return null;
        }

        if (! empty($this->ticket_token_hash)) {
            $hashMatches = hash_equals((string) $this->ticket_token_hash, self::hashMagicToken($token));
            if (! $hashMatches) {
                return null;
            }
        }

        return $token;
    }

    private function buildMagicLinkUrl(string $token): string
    {
        $baseUrl = rtrim((string) config('ticket_magic_link.public_base_url', config('app.url')), '/');
        $path = route('tickets.magic.show', ['token' => $token], false);

        return $baseUrl . $path;
    }

    public function isMagicTokenExpired(): bool
    {
        return $this->token_expires_at !== null && $this->token_expires_at->isPast();
    }

    private function applyMagicTokenExpirationPolicy(): void
    {
        $isResolvedState = in_array((string) $this->status, ['resolved', 'closed'], true)
            || (bool) $this->is_resolved;

        $becameResolved = (
            $this->isDirty('status')
            && in_array((string) $this->status, ['resolved', 'closed'], true)
        ) || ($this->isDirty('is_resolved') && (bool) $this->is_resolved);

        if ($isResolvedState) {
            $days = max(1, (int) config('ticket_magic_link.expire_days_after_resolution', 30));

            if ($this->token_expires_at === null || $becameResolved) {
                $this->token_expires_at = now()->addDays($days);
            }

            return;
        }

        if ($this->isDirty('status') || $this->isDirty('is_resolved')) {
            $this->token_expires_at = null;
        }
    }

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

    public function scopeStandardOnly(Builder $query): Builder
    {
        return $query->where(function (Builder $builder) {
            $builder
                ->whereNull('ticket_kind')
                ->orWhere('ticket_kind', 'standard');
        })->where(function (Builder $builder) {
            $builder
                ->whereNull('category_id')
                ->orWhereDoesntHave('category', function (Builder $categoryQuery) {
                    $categoryQuery->whereIn('name', self::SPECIAL_CATEGORY_NAMES);
                });
        });
    }

    public function scopeSpecialOnly(Builder $query): Builder
    {
        return $query->where(function (Builder $builder) {
            $builder
                ->whereIn('ticket_kind', ['bug', 'improvement'])
                ->orWhereHas('category', function (Builder $categoryQuery) {
                    $categoryQuery->whereIn('name', self::SPECIAL_CATEGORY_NAMES);
                });
        });
    }
}
