<?php

use App\Models\Agent;
use App\Models\InternalTicket;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('authenticated users can create an internal ticket without creating a normal ticket', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/internal-tickets', [
        'title' => 'Erreur sur le tableau de bord',
        'description' => 'Le compteur ne se rafraichit pas apres retour de navigation.',
        'category' => 'bug',
    ]);

    $ticket = InternalTicket::query()->first();

    $response->assertRedirect('/internal-tickets/' . $ticket?->id);

    $this->assertDatabaseHas('internal_tickets', [
        'user_id' => $user->id,
        'title' => 'Erreur sur le tableau de bord',
        'category' => 'bug',
    ]);

    $this->assertDatabaseCount('internal_tickets', 1);
    $this->assertDatabaseCount(config('laravel_ticket.table_names.tickets', 'tickets'), 0);
});

test('internal tickets do not affect dashboard ticket stats', function () {
    $user = User::factory()->create();

    InternalTicket::create([
        'user_id' => $user->id,
        'title' => 'Suggestion interface',
        'description' => 'Ajouter un raccourci vers les statistiques.',
        'category' => 'improvement',
    ]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('summary.total', 0)
            ->where('summary.open', 0)
            ->where('summary.pending', 0)
            ->where('summary.closed', 0)
        );
});

test('processed internal tickets are hidden by default from index', function () {
    $user = User::factory()->create();

    InternalTicket::create([
        'user_id' => $user->id,
        'title' => 'Ancien bug',
        'description' => 'Deja pris en compte.',
        'category' => 'bug',
        'processed_at' => now(),
    ]);

    $this->actingAs($user)
        ->get('/internal-tickets')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('InternalTickets/Index')
            ->where('tickets', [])
            ->where('showProcessed', false)
        );
});

test('agents can mark an internal ticket as processed', function () {
    $agentUser = User::factory()->create();
    Agent::create([
        'user_id' => $agentUser->id,
        'is_admin' => false,
        'is_active' => true,
    ]);

    $requester = User::factory()->create();
    $ticket = InternalTicket::create([
        'user_id' => $requester->id,
        'title' => 'Evolution SAV',
        'description' => 'Ajouter un raccourci de traitement.',
        'category' => 'improvement',
    ]);

    $this->actingAs($agentUser)
        ->patch('/internal-tickets/' . $ticket->id . '/process')
        ->assertRedirect('/internal-tickets');

    $this->assertDatabaseHas('internal_tickets', [
        'id' => $ticket->id,
        'processed_by_id' => $agentUser->id,
    ]);

    expect($ticket->fresh()?->processed_at)->not->toBeNull();
});
