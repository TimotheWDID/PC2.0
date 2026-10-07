<?php

use App\Models\Agent;
use App\Models\RemoteIntervention;
use App\Models\RemoteSubscription;
use App\Models\Ticket;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function remoteAgent(): User
{
    $user = User::factory()->create();
    Agent::create(['user_id' => $user->id, 'is_admin' => false, 'is_active' => true]);

    return $user;
}

function remoteSubscription(array $overrides = []): RemoteSubscription
{
    return RemoteSubscription::create([
        'user_id' => User::factory()->create()->id,
        'plan' => 'NinjaOne Essentiel',
        'status' => 'active',
        'started_on' => '2026-01-01',
        'included_minutes' => 300,
        ...$overrides,
    ]);
}

it('is reserved to agents', function () {
    $subscription = remoteSubscription();

    $this->get(route('remote-subscriptions.index'))->assertRedirect(route('login'));

    $this->actingAs($subscription->user)
        ->get(route('remote-subscriptions.index'))
        ->assertForbidden();

    $this->actingAs($subscription->user)
        ->get(route('remote-subscriptions.show', $subscription))
        ->assertForbidden();
});

it('creates a subscription for a client', function () {
    $client = User::factory()->create();

    $response = $this->actingAs(remoteAgent())->post(route('remote-subscriptions.store'), [
        'user_id' => $client->id,
        'plan' => 'NinjaOne Pro',
        'status' => 'active',
        'started_on' => '2026-10-01',
        'ends_on' => '2027-09-30',
        'included_minutes' => 600,
        'price' => '29.90',
        'devices_count' => 3,
        'ninjaone_reference' => 'Org-42',
    ]);

    $subscription = RemoteSubscription::firstOrFail();
    $response->assertRedirect(route('remote-subscriptions.show', $subscription));

    expect($subscription->user_id)->toBe($client->id)
        ->and($subscription->included_minutes)->toBe(600)
        ->and($subscription->ends_on->toDateString())->toBe('2027-09-30');
});

it('validates the subscription fields', function () {
    $this->actingAs(remoteAgent())
        ->post(route('remote-subscriptions.store'), [
            'plan' => '',
            'status' => 'unknown',
            'started_on' => '2026-10-01',
            'ends_on' => '2026-09-01',
            'included_minutes' => -5,
        ])
        ->assertSessionHasErrors(['user_id', 'plan', 'status', 'ends_on', 'included_minutes']);

    expect(RemoteSubscription::count())->toBe(0);
});

it('logs remote interventions and computes the remaining time', function () {
    $agent = remoteAgent();
    $subscription = remoteSubscription();
    $ticket = Ticket::create([
        'user_id' => $subscription->user_id,
        'title' => 'Imprimante',
        'message' => 'Ne imprime plus',
        'priority' => 'low',
        'status' => 'pending',
    ]);

    $this->actingAs($agent)
        ->post(route('remote-subscriptions.interventions.store', $subscription), [
            'performed_at' => '2026-10-07T14:30:00.000Z',
            'duration_minutes' => 45,
            'description' => 'Réinstallation du pilote',
            'ticket_id' => $ticket->id,
        ])
        ->assertSessionHasNoErrors();

    $subscription->interventions()->create([
        'performed_at' => now(),
        'duration_minutes' => 300,
        'description' => 'Migration de poste',
    ]);

    $intervention = RemoteIntervention::where('ticket_id', $ticket->id)->firstOrFail();
    expect($intervention->technician_id)->toBe($agent->id)
        ->and($intervention->performed_at->format('Y-m-d H:i'))->toBe('2026-10-07 14:30');

    $this->actingAs($agent)
        ->get(route('remote-subscriptions.show', $subscription))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('RemoteSubscriptions/Show', false)
            ->where('subscription.used_minutes', 345)
            ->where('subscription.remaining_minutes', -45)
            ->has('interventions', 2)
            ->has('tickets', 1));

    $this->actingAs($agent)
        ->get(route('remote-subscriptions.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('RemoteSubscriptions/Index', false)
            ->where('subscriptions.0.remaining_minutes', -45));
});

it('refuses a ticket that belongs to another client', function () {
    $subscription = remoteSubscription();
    $otherTicket = Ticket::create([
        'user_id' => User::factory()->create()->id,
        'title' => 'Autre',
        'message' => 'Autre client',
        'priority' => 'low',
        'status' => 'pending',
    ]);

    $this->actingAs(remoteAgent())
        ->post(route('remote-subscriptions.interventions.store', $subscription), [
            'performed_at' => '2026-10-07T14:30:00.000Z',
            'duration_minutes' => 15,
            'description' => 'Test',
            'ticket_id' => $otherTicket->id,
        ])
        ->assertSessionHasErrors('ticket_id');

    expect(RemoteIntervention::count())->toBe(0);
});

it('updates a subscription and deletes interventions', function () {
    $agent = remoteAgent();
    $subscription = remoteSubscription();
    $intervention = $subscription->interventions()->create([
        'performed_at' => now(),
        'duration_minutes' => 30,
        'description' => 'Contrôle',
    ]);

    $this->actingAs($agent)
        ->patch(route('remote-subscriptions.update', $subscription), [
            'plan' => 'NinjaOne Pro',
            'status' => 'suspended',
            'started_on' => '2026-01-01',
            'included_minutes' => 600,
        ])
        ->assertSessionHasNoErrors();

    expect($subscription->fresh()->status)->toBe('suspended')
        ->and($subscription->fresh()->included_minutes)->toBe(600);

    $other = remoteSubscription();
    $this->actingAs($agent)
        ->delete(route('remote-subscriptions.interventions.destroy', [$other, $intervention]))
        ->assertNotFound();

    $this->actingAs($agent)
        ->delete(route('remote-subscriptions.interventions.destroy', [$subscription, $intervention]))
        ->assertRedirect();

    expect(RemoteIntervention::count())->toBe(0);
});
