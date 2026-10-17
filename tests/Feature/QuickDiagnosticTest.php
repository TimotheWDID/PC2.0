<?php

use App\Models\Agent;
use App\Models\Device;
use App\Models\Diagnostic;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function quickDiagAgent(): User
{
    $user = User::factory()->create();
    Agent::create(['user_id' => $user->id, 'is_admin' => false, 'is_active' => true]);

    return $user;
}

function quickDiagTicket(?Device $device = null): Ticket
{
    $client = $device?->user ?? User::factory()->create();

    return Ticket::create([
        'user_id' => $client->id,
        'device_id' => $device?->id,
        'title' => 'PC lent',
        'message' => 'Le PC rame au demarrage.',
        'priority' => 'medium',
        'status' => 'pending',
    ]);
}

function quickDiagPayload(array $inventory = []): array
{
    return [
        'report' => json_encode([
            'format' => 'diag-atelier',
            'machine' => ['name' => 'MSI GL65 Leopard 10SFK'],
            'status' => ['overall' => 'warn', 'overallLabel' => 'Quelques points à surveiller'],
            'viability' => ['score' => 72, 'level' => 'good', 'verdict' => 'PC viable'],
        ]),
        'inventory' => json_encode($inventory),
        'state' => json_encode(['notes' => 'RAS']),
        'files' => [UploadedFile::fake()->createWithContent('rapport.csv', 'a,b,c')],
        'file_sources' => ['aida'],
        'file_names' => ['rapport.csv'],
        'file_encodings' => ['plain'],
    ];
}

it('serves the quick diag page and tool to agents only', function () {
    $agent = quickDiagAgent();

    $this->actingAs($agent)
        ->get(route('diag.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Diagnostics/Index')->has('diagnostics', 0));

    $this->actingAs($agent)
        ->get(route('diag.tool'))
        ->assertOk()
        ->assertSee('window.DIAG_TICKET', false)
        ->assertSee('"quick":', false)
        ->assertSee('/diag/diagnostics', false);

    $client = User::factory()->create();
    $this->actingAs($client)->get(route('diag.index'))->assertForbidden();
    $this->actingAs($client)->get(route('diag.tool'))->assertForbidden();
    $this->actingAs($client)->post(route('diag.diagnostics.store'), quickDiagPayload())->assertForbidden();
});

it('saves a quick diag without a ticket and lists it', function () {
    Storage::fake('local');
    $agent = quickDiagAgent();

    $this->actingAs($agent)
        ->post(route('diag.diagnostics.store'), quickDiagPayload(['brand' => 'MSI', 'serial' => 'K1234']), ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonStructure(['id', 'report_url', 'list_url']);

    $diagnostic = Diagnostic::firstOrFail();
    expect($diagnostic->ticket_id)->toBeNull()
        ->and($diagnostic->device_id)->toBeNull()
        ->and($diagnostic->technician_id)->toBe($agent->id)
        ->and($diagnostic->inventory)->toBe(['brand' => 'MSI', 'serial' => 'K1234']);
    Storage::disk('local')->assertExists($diagnostic->files[0]['path']);
    expect(Device::count())->toBe(0);

    $this->actingAs($agent)
        ->get(route('diag.index'))
        ->assertInertia(fn ($page) => $page
            ->has('diagnostics', 1)
            ->where('diagnostics.0.serial', 'K1234'));

    $this->actingAs($agent)
        ->get(route('diag.diagnostics.show', $diagnostic))
        ->assertOk()
        ->assertSee('/diag/diagnostics/'.$diagnostic->id.'/files/aida', false);

    $this->actingAs($agent)
        ->get(route('diag.diagnostics.file', [$diagnostic, 'aida']))
        ->assertOk();
});

it('attaches a quick diag to a ticket and fills its device', function () {
    Storage::fake('local');
    $agent = quickDiagAgent();
    $ticket = quickDiagTicket();

    $this->actingAs($agent)
        ->post(route('diag.diagnostics.store'), quickDiagPayload(['brand' => 'MSI', 'serial' => 'K1234']), ['Accept' => 'application/json'])
        ->assertCreated();
    $diagnostic = Diagnostic::firstOrFail();

    $this->actingAs($agent)
        ->post(route('diag.diagnostics.attach', $diagnostic), ['ticket_id' => $ticket->id])
        ->assertRedirect(route('tickets.show', $ticket));

    $diagnostic->refresh();
    $ticket->refresh();
    expect($diagnostic->ticket_id)->toBe($ticket->id)
        ->and($ticket->device)->not->toBeNull()
        ->and($ticket->device->serial_number)->toBe('K1234')
        ->and($diagnostic->device_id)->toBe($ticket->device_id);

    $this->assertDatabaseHas('ticket_timeline_events', ['ticket_id' => $ticket->id, 'event_type' => 'diagnostic_added']);
    $this->assertDatabaseHas('device_events', ['ticket_id' => $ticket->id, 'event_type' => 'diagnostic']);

    // Once attached, it lives on the ticket: gone from the quick list, quick URLs lead to the ticket
    $this->actingAs($agent)
        ->get(route('diag.index'))
        ->assertInertia(fn ($page) => $page->has('diagnostics', 0));
    $this->actingAs($agent)
        ->get(route('diag.diagnostics.show', $diagnostic))
        ->assertRedirect(route('tickets.diagnostics.show', [$ticket, $diagnostic]));
    $this->actingAs($agent)
        ->post(route('diag.diagnostics.attach', $diagnostic), ['ticket_id' => $ticket->id])
        ->assertNotFound();
});

it('refuses to attach a quick diag to a missing ticket', function () {
    Storage::fake('local');
    $agent = quickDiagAgent();

    $this->actingAs($agent)
        ->post(route('diag.diagnostics.store'), quickDiagPayload(), ['Accept' => 'application/json'])
        ->assertCreated();
    $diagnostic = Diagnostic::firstOrFail();

    $this->actingAs($agent)
        ->post(route('diag.diagnostics.attach', $diagnostic), ['ticket_id' => 999999])
        ->assertSessionHasErrors('ticket_id');

    expect($diagnostic->fresh()->ticket_id)->toBeNull();
});

it('deletes a quick diag with its files', function () {
    Storage::fake('local');
    $agent = quickDiagAgent();

    $this->actingAs($agent)
        ->post(route('diag.diagnostics.store'), quickDiagPayload(), ['Accept' => 'application/json'])
        ->assertCreated();
    $diagnostic = Diagnostic::firstOrFail();

    $this->actingAs($agent)
        ->delete(route('diag.diagnostics.destroy', $diagnostic))
        ->assertRedirect();

    expect(Diagnostic::count())->toBe(0);
    Storage::disk('local')->assertMissing($diagnostic->files[0]['path']);
});
