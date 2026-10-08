<?php

use App\Models\Agent;
use App\Models\Ticket;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function companyAgent(): User
{
    $user = User::factory()->create();
    Agent::create(['user_id' => $user->id, 'is_admin' => true, 'is_active' => true]);

    return $user;
}

function makeCompany(string $name = 'Acme SARL'): User
{
    return User::create([
        'client_type' => User::TYPE_COMPANY,
        'company_name' => $name,
        'siret' => '12345678900012',
        'email' => strtolower(str_replace(' ', '', $name)).'@example.test',
    ]);
}

it('keeps existing clients as persons', function () {
    $user = User::factory()->create(['first_name' => 'Jean', 'last_name' => 'Dupont']);

    expect($user->fresh()->client_type)->toBe(User::TYPE_PERSON)
        ->and($user->fresh()->isCompany())->toBeFalse()
        ->and($user->fresh()->name)->toBe('Jean Dupont');
});

it('names a company after its company name everywhere', function () {
    $company = makeCompany('Planete Pro')->fresh();

    expect($company->isCompany())->toBeTrue()
        ->and($company->name)->toBe('Planete Pro')
        ->and(trim($company->first_name.' '.$company->last_name))->toBe('Planete Pro');
});

it('creates a company from the clients page', function () {
    $this->actingAs(companyAgent())
        ->post(route('users.store'), [
            'client_type' => 'company',
            'company_name' => 'Boulangerie Martin',
            'siret' => '98765432100011',
            'email' => 'contact@boulangerie.test',
        ])
        ->assertRedirect(route('users.index', ['type' => 'company']));

    $company = User::where('email', 'contact@boulangerie.test')->firstOrFail();

    expect($company->client_type)->toBe(User::TYPE_COMPANY)
        ->and($company->name)->toBe('Boulangerie Martin')
        ->and($company->siret)->toBe('98765432100011');
});

it('requires a company name for a company and names for a person', function () {
    $this->actingAs(companyAgent())
        ->post(route('users.store'), ['client_type' => 'company'])
        ->assertSessionHasErrors('company_name');

    $this->actingAs(companyAgent())
        ->post(route('users.store'), ['client_type' => 'person'])
        ->assertSessionHasErrors(['first_name', 'last_name']);
});

it('links a person to a company optionally', function () {
    $company = makeCompany();

    $this->actingAs(companyAgent())
        ->post(route('users.store'), [
            'client_type' => 'person',
            'first_name' => 'Claire',
            'last_name' => 'Martin',
            'email' => 'claire@example.test',
            'company_id' => $company->id,
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs(companyAgent())
        ->post(route('users.store'), [
            'client_type' => 'person',
            'first_name' => 'Paul',
            'last_name' => 'Seul',
            'email' => 'paul@example.test',
        ])
        ->assertSessionHasNoErrors();

    expect(User::where('email', 'claire@example.test')->first()->company_id)->toBe($company->id)
        ->and(User::where('email', 'paul@example.test')->first()->company_id)->toBeNull();
});

it('refuses to link a person to another person', function () {
    $person = User::factory()->create();

    $this->actingAs(companyAgent())
        ->post(route('users.store'), [
            'client_type' => 'person',
            'first_name' => 'Claire',
            'last_name' => 'Martin',
            'company_id' => $person->id,
        ])
        ->assertSessionHasErrors('company_id');
});

it('keeps company and member tickets on their own pages', function () {
    $company = makeCompany();
    $member = User::factory()->create(['first_name' => 'Claire', 'last_name' => 'Martin', 'company_id' => $company->id]);

    $companyTicket = Ticket::create([
        'user_id' => $company->id,
        'title' => 'Serveur en panne',
        'priority' => 'high',
        'status' => 'open',
    ]);
    $memberTicket = Ticket::create([
        'user_id' => $member->id,
        'title' => 'Imprimante',
        'priority' => 'low',
        'status' => 'open',
    ]);

    $this->actingAs(companyAgent())
        ->get(route('users.show-page', $company))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Users/Show')
            ->where('user.client_type', 'company')
            ->where('user.name', 'Acme SARL')
            ->has('members', 1)
            ->where('members.0.id', $member->id)
            ->has('tickets', 1)
            ->where('tickets.0.id', $companyTicket->id)
        );

    $this->actingAs(companyAgent())
        ->get(route('users.show-page', $member))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('user.company.id', $company->id)
            ->where('user.company.name', 'Acme SARL')
            ->has('tickets', 1)
            ->where('tickets.0.id', $memberTicket->id)
        );

    expect($companyTicket->fresh()->user->name)->toBe('Acme SARL');
});

it('lists companies and persons with their type', function () {
    $company = makeCompany();
    User::factory()->create(['company_id' => $company->id]);

    $this->actingAs(companyAgent())
        ->get(route('users.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Users/Index')
            ->where('users', fn ($users) => collect($users)->contains(
                fn ($user) => $user['id'] === $company->id
                    && $user['client_type'] === 'company'
                    && $user['members_count'] === 1
            ))
        );
});

it('does not turn a company with members back into a person', function () {
    $company = makeCompany();
    User::factory()->create(['company_id' => $company->id]);

    $this->actingAs(companyAgent())
        ->put(route('users.update', $company), [
            'client_type' => 'person',
            'first_name' => 'Jean',
            'last_name' => 'Dupont',
            'default_notification_preference' => 'None',
        ])
        ->assertSessionHasErrors('client_type');

    expect($company->fresh()->isCompany())->toBeTrue();
});

it('creates a company from the ticket form quick creation', function () {
    $this->actingAs(companyAgent())
        ->postJson(route('tickets.quickUser'), [
            'client_type' => 'company',
            'company_name' => 'Garage Dupuis',
            'phone' => '0102030405',
        ])
        ->assertOk()
        ->assertJsonPath('user.name', 'Garage Dupuis')
        ->assertJsonPath('user.client_type', 'company');

    $company = User::where('company_name', 'Garage Dupuis')->firstOrFail();
    expect($company->isCompany())->toBeTrue();
});

it('creates a person attached to a company from the ticket form', function () {
    $company = makeCompany();

    $this->actingAs(companyAgent())
        ->postJson(route('tickets.quickUser'), [
            'client_type' => 'person',
            'first_name' => 'Lea',
            'last_name' => 'Roux',
            'company_id' => $company->id,
        ])
        ->assertOk()
        ->assertJsonPath('user.name', 'Lea Roux')
        ->assertJsonPath('user.company_name', 'Acme SARL');
});

it('lets an agent move a ticket to another client', function () {
    $person = User::factory()->create();
    $company = makeCompany();
    $device = \App\Models\Device::create([
        'user_id' => $person->id,
        'device_type' => 'computer',
        'status' => 'active',
    ]);
    $ticket = Ticket::create([
        'user_id' => $person->id,
        'device_id' => $device->id,
        'title' => 'Mauvais client',
        'priority' => 'low',
        'status' => 'open',
    ]);

    $this->actingAs(companyAgent())
        ->put(route('tickets.update', $ticket), [
            'user_id' => $company->id,
            'title' => 'Mauvais client',
            'category_id' => null,
            'device_id' => $device->id,
            'notify_by' => 'None',
        ])
        ->assertRedirect(route('tickets.show', $ticket));

    $ticket->refresh();

    expect($ticket->user_id)->toBe($company->id)
        ->and($ticket->device_id)->toBeNull();
});

it('does not let a customer move their ticket to another client', function () {
    $person = User::factory()->create();
    $other = User::factory()->create();
    $ticket = Ticket::create([
        'user_id' => $person->id,
        'title' => 'Mon ticket',
        'priority' => 'low',
        'status' => 'open',
    ]);

    $this->actingAs($person)->put(route('tickets.update', $ticket), [
        'user_id' => $other->id,
        'title' => 'Mon ticket',
        'category_id' => null,
        'notify_by' => 'None',
    ]);

    expect($ticket->fresh()->user_id)->toBe($person->id);
});
