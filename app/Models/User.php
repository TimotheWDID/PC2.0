<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Illuminate\Notifications\Notification;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'password',
        'phone',
        'address',
        'internal_note',
        'hiboutik_id',
        'ticket_label_settings',
        'default_notification_preference',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'ticket_label_settings' => 'array',
        ];
    }

    /**
     * Accessor for a virtual `name` attribute used by the frontend.
     */
    public function getNameAttribute(): string
    {
        return trim(($this->first_name ?? '') . ' ' . ($this->last_name ?? ''));
    }

    /**
     * Accessor for an `avatar` attribute. Returns null by default
     * (no `avatar` column in the schema). Customize to return a
     * gravatar URL or stored avatar path if you add such a column.
     */
    public function getAvatarAttribute(): ?string
    {
        return $this->attributes['avatar'] ?? null;
    }

    /**
     * Relation to Agent model when a user is an agent.
     */
    public function agent(): HasOne
    {
        return $this->hasOne(Agent::class);
    }

    public function devices(): HasMany
    {
        return $this->hasMany(Device::class);
    }

    public function assignedTickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'assignee_id');
    }

    public function internalTickets(): HasMany
    {
        return $this->hasMany(InternalTicket::class);
    }

    public function routeNotificationForSmsfactory(?Notification $notification = null): ?string
    {
        $phone = trim((string) ($this->phone ?? ''));

        return $phone !== '' ? $phone : null;
    }
}
