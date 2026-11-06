<?php

use App\Models\Agent;
use App\Models\Ticket;
use App\Models\User;

function accessAgent(bool $isActive = true, bool $isAdmin = false): User
{
    $user = User::factory()->withoutTwoFactor()->create();
    Agent::create(['user_id' => $user->id, 'is_admin' => $isAdmin, 'is_active' => $isActive]);

    return $user;
}

it('refuses the login of a disabled technician', function () {
    $user = accessAgent(isActive: false);

    $this->post('/login', ['email' => $user->email, 'password' => 'password'])
        ->assertSessionHasErrors('email');

    $this->assertGuest();
});

it('still lets an active technician log in', function () {
    $user = accessAgent();

    $this->post('/login', ['email' => $user->email, 'password' => 'password']);

    $this->assertAuthenticatedAs($user);
});

it('ends the session of a technician disabled while logged in', function () {
    $user = accessAgent(isActive: false);

    $this->actingAs($user)->get('/dashboard')->assertRedirect(route('login'));

    $this->assertGuest();
});

it('removes all access when a technician is deleted, without losing history', function () {
    $admin = accessAgent(isAdmin: true);
    $technician = accessAgent();
    $ticket = Ticket::create([
        'user_id' => User::factory()->create()->id,
        'assignee_id' => $technician->id,
        'title' => 'Ecran casse',
        'message' => 'Ecran fissure.',
        'priority' => 'medium',
        'status' => 'open',
    ]);

    $this->actingAs($admin)->delete(route('agents.destroy', $technician->agent->id))
        ->assertRedirect(route('agents.index'));

    expect($technician->agent()->first()->is_active)->toBeFalse()
        ->and($ticket->fresh()->assignee_id)->toBeNull()
        ->and(User::find($technician->id))->not->toBeNull();

    auth()->logout();
    $this->post('/login', ['email' => $technician->email, 'password' => 'password'])
        ->assertSessionHasErrors('email');
    $this->assertGuest();
});

it('stops an admin from locking themselves out', function () {
    $admin = accessAgent(isAdmin: true);

    $this->actingAs($admin)->delete(route('agents.destroy', $admin->agent->id))->assertForbidden();
    $this->actingAs($admin)->patch(route('agents.update', $admin->agent->id), ['is_active' => false])->assertForbidden();

    expect($admin->agent()->first()->is_active)->toBeTrue();
});

it('keeps orders closed to clients', function () {
    $this->actingAs(User::factory()->create())->get('/commandes')->assertForbidden();
});
