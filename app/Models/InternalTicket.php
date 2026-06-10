<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InternalTicket extends Model
{
    use HasFactory;

    public const CATEGORY_BUG = 'bug';
    public const CATEGORY_IMPROVEMENT = 'improvement';

    public const CATEGORY_LABELS = [
        self::CATEGORY_BUG => 'Bug',
        self::CATEGORY_IMPROVEMENT => 'Amelioration',
    ];

    protected $fillable = [
        'user_id',
        'category',
        'title',
        'description',
        'processed_at',
        'processed_by_id',
    ];

    protected $casts = [
        'processed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function processedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by_id');
    }

    public static function allowedCategories(): array
    {
        return array_keys(self::CATEGORY_LABELS);
    }

    public static function labelFor(?string $category): string
    {
        return self::CATEGORY_LABELS[$category ?? ''] ?? 'Autre';
    }

    public function isProcessed(): bool
    {
        return $this->processed_at !== null;
    }
}
