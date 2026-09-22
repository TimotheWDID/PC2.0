<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DevisMessage extends Model
{
    use HasFactory;

    protected $fillable = ['devis_id', 'user_id', 'body'];

    public function devis(): BelongsTo
    {
        return $this->belongsTo(Devis::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
