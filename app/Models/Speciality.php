<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Speciality extends Model
{
    protected $fillable = [
        'name',
    ];

    public function agents(): HasMany
    {
        return $this->hasMany(Agent::class);
    }

    public function agentModels(): BelongsToMany
    {
        return $this->belongsToMany(Agent::class, 'agent_speciality');
    }
}
