<?php

use App\Models\Agent;
use App\Models\Ticket;
use App\Models\User;
use Carbon\Carbon;

test('creating a technician timeline event updates parent ticket timestamp', function () {
    $agentUser = User::factory()->create();
    Agent::create([
        'user_id' => $agentUser->id,
        'is_admin' => false,
        'is_active' => true,
    ]);

    $requester = User::factory()->create();

    $ticket = Ticket::create([
        'user_id' => $requester->id,
        'title' => 'PC ne demarre plus',
        'message' => 'Ecran noir au demarrage.',
        'priority' => 'medium',
        'status' => 'pending',
    ]);

    $staleUpdatedAt = now()->subDays(3);
    Ticket::query()->whereKey($ticket->id)->update(['updated_at' => $staleUpdatedAt]);

    $this->actingAs($agentUser)
        ->post(route('tickets.timelineEvents.store', ['ticket' => $ticket->id]), [
            'event_type' => 'manual_note',
            'summary' => 'Suivi technicien ajoute',
            'details' => 'Relance effectuee, en attente de retour client.',
        ])
        ->assertStatus(302);

    $ticket->refresh();

    $this->assertDatabaseHas('ticket_timeline_events', [
        'ticket_id' => $ticket->id,
        'technician_id' => $agentUser->id,
        'event_type' => 'manual_note',
        'summary' => 'Suivi technicien ajoute',
    ]);

    expect(Carbon::parse($ticket->updated_at)->greaterThan($staleUpdatedAt))->toBeTrue();
});
