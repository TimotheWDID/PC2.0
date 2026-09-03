<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Commande extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'ticket_id',
        'nom',
        'fournisseur',
        'command_number',
        'invoice_id',
        'prix_ht',
        'coefficient_marge',
        'prix_vente_ttc',
        'statut',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'prix_ht' => 'decimal:2',
        'coefficient_marge' => 'decimal:2',
        'prix_vente_ttc' => 'decimal:2',
    ];

    /**
     * Get the user that owns the commande.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the ticket associated with the commande.
     */
    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    /**
     * Scope a query to filter by status.
     */
    public function scopeByStatut($query, $statut)
    {
        return $query->where('statut', $statut);
    }

    /**
     * Scope a query to filter by fournisseur.
     */
    public function scopeByFournisseur($query, $fournisseur)
    {
        return $query->where('fournisseur', 'like', "%{$fournisseur}%");
    }
}
