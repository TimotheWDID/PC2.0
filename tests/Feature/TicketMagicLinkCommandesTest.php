<?php

use App\Models\Commande;
use App\Models\Ticket;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function magicLinkTicket(): Ticket
{
    $client = User::factory()->create();

    return Ticket::create([
        'user_id' => $client->id,
        'title' => 'PC lent',
        'message' => 'Le PC rame.',
        'priority' => 'medium',
        'status' => 'in_progress',
    ]);
}

it('shows the progress of the ticket orders on the magic link page without sensitive data', function () {
    $ticket = magicLinkTicket();
    $otherTicket = magicLinkTicket();
    $token = $ticket->getOrCreateMagicLink()['token'];

    Commande::create([
        'user_id' => $ticket->user_id,
        'ticket_id' => $ticket->id,
        'nom' => 'SSD 1 To',
        'fournisseur' => 'Fournisseur secret',
        'command_number' => 'CMD-42',
        'prix_ht' => 80,
        'coefficient_marge' => 1.5,
        'prix_vente_ttc' => 144,
        'statut' => 'commandé',
    ]);
    Commande::create([
        'user_id' => $otherTicket->user_id,
        'ticket_id' => $otherTicket->id,
        'nom' => 'Autre piece',
        'statut' => 'new',
    ]);

    $this->get(route('tickets.magic.show', $token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Tickets/PublicShow', false)
            ->has('commandes', 1)
            ->where('commandes.0.nom', 'SSD 1 To')
            ->where('commandes.0.statut', 'commandé')
            ->missing('commandes.0.fournisseur')
            ->missing('commandes.0.command_number')
            ->missing('commandes.0.prix_ht')
            ->missing('commandes.0.coefficient_marge')
            ->missing('commandes.0.prix_vente_ttc'));
});

it('sends an empty order list when the ticket has no orders', function () {
    $ticket = magicLinkTicket();
    $token = $ticket->getOrCreateMagicLink()['token'];

    $this->get(route('tickets.magic.show', $token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Tickets/PublicShow', false)
            ->has('commandes', 0));
});
