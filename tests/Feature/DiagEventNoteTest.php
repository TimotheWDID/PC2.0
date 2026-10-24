<?php

use App\Models\Agent;
use App\Models\DiagAppToken;
use App\Models\DiagEventNote;
use App\Models\User;

function eventNoteAgent(): User
{
    $user = User::factory()->create(['first_name' => 'Tim', 'last_name' => 'Tech']);
    Agent::create(['user_id' => $user->id, 'is_admin' => false, 'is_active' => true]);

    return $user;
}

function eventNotePayload(array $overrides = []): array
{
    return array_merge([
        'source' => 'Netwtw10',
        'event_id' => 6062,
        'sev' => 'warn',
        'noise' => false,
        'title' => 'Le pilote Wi-Fi Intel a perdu la connexion',
        'explain' => 'La carte Wi-Fi Intel s\'est déconnectée puis reconnectée.',
        'advice' => 'Mettre à jour le pilote Wi-Fi Intel.',
        'causes' => ['Pilote Wi-Fi ancien', '  ', 'Économie d\'énergie de la carte'],
    ], $overrides);
}

it('lets the app teach an unknown event and every app read it back', function () {
    $agent = eventNoteAgent();
    [, $plain] = DiagAppToken::issue($agent, 'Clé USB');

    $this->withToken($plain)
        ->postJson('/api/diag-app/event-notes', eventNotePayload())
        ->assertCreated()
        ->assertJsonPath('note.title', 'Le pilote Wi-Fi Intel a perdu la connexion')
        ->assertJsonPath('note.causes', ['Pilote Wi-Fi ancien', 'Économie d\'énergie de la carte'])
        ->assertJsonPath('note.by', 'Tim Tech');

    // a colleague's app, on another install
    [, $other] = DiagAppToken::issue(eventNoteAgent(), 'Autre clé');
    $this->withToken($other)
        ->getJson('/api/diag-app/event-notes')
        ->assertOk()
        ->assertJsonCount(1, 'notes')
        ->assertJsonPath('notes.0.source', 'Netwtw10')
        ->assertJsonPath('notes.0.event_id', 6062);
});

it('updates the note of an event already taught instead of duplicating it', function () {
    [, $plain] = DiagAppToken::issue(eventNoteAgent(), 'Clé USB');
    $this->withToken($plain)->postJson('/api/diag-app/event-notes', eventNotePayload())->assertCreated();

    $this->withToken($plain)
        ->postJson('/api/diag-app/event-notes', eventNotePayload(['title' => 'Wi-Fi Intel déconnecté', 'causes' => "Pilote ancien\nRouteur"]))
        ->assertOk()
        ->assertJsonPath('note.causes', ['Pilote ancien', 'Routeur']);

    expect(DiagEventNote::count())->toBe(1)
        ->and(DiagEventNote::sole()->title)->toBe('Wi-Fi Intel déconnecté');
});

it('refuses an incomplete note', function () {
    [, $plain] = DiagAppToken::issue(eventNoteAgent(), 'Clé USB');

    $this->withToken($plain)
        ->postJson('/api/diag-app/event-notes', eventNotePayload(['title' => '', 'sev' => 'bad']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['title', 'sev']);
    $this->withoutToken()->getJson('/api/diag-app/event-notes')->assertUnauthorized();
});

it('lets an agent review, fix and delete the notes on the site', function () {
    $agent = eventNoteAgent();

    $this->actingAs($agent)
        ->post(route('diag.event-notes.store'), eventNotePayload(['causes' => "Pilote ancien\n\nRouteur"]))
        ->assertRedirect();
    $note = DiagEventNote::sole();
    expect($note->causes)->toBe(['Pilote ancien', 'Routeur']);

    $this->actingAs($agent)
        ->post(route('diag.event-notes.store'), eventNotePayload())
        ->assertSessionHasErrors('source');

    $this->actingAs($agent)
        ->get(route('diag.event-notes.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Diagnostics/EventNotes')->has('notes', 1));

    $this->actingAs($agent)
        ->patch(route('diag.event-notes.update', $note), eventNotePayload(['noise' => true, 'sev' => 'info', 'causes' => '']))
        ->assertRedirect();
    expect($note->fresh()->noise)->toBeTrue()
        ->and($note->fresh()->causes)->toBe([])
        ->and($note->fresh()->updated_by)->toBe($agent->id);

    $this->actingAs($agent)->delete(route('diag.event-notes.destroy', $note))->assertRedirect();
    expect(DiagEventNote::count())->toBe(0);
});

it('keeps the notes away from non agents', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('diag.event-notes.index'))
        ->assertForbidden();
});
