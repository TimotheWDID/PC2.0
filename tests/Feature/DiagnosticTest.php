<?php

use App\Models\Agent;
use App\Models\Device;
use App\Models\Diagnostic;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function diagAgent(): User
{
    $user = User::factory()->create();
    Agent::create(['user_id' => $user->id, 'is_admin' => false, 'is_active' => true]);

    return $user;
}

function diagTicket(?Device $device = null): Ticket
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

function diagReport(array $overrides = []): string
{
    return json_encode(array_replace_recursive([
        'format' => 'diag-atelier',
        'machine' => ['name' => 'MSI GL65 Leopard 10SFK', 'serialNumber' => 'K1234'],
        'status' => ['overall' => 'warn', 'overallLabel' => 'Quelques points à surveiller'],
        'viability' => ['score' => 72, 'level' => 'good', 'verdict' => 'PC viable'],
    ], $overrides));
}

it('serves the diag page with the ticket context to agents only', function () {
    $ticket = diagTicket();

    $this->actingAs(diagAgent())
        ->get(route('tickets.diag', $ticket))
        ->assertOk()
        ->assertSee('window.DIAG_TICKET', false)
        ->assertSee('/tickets/'.$ticket->id.'/diagnostics', false);

    $this->actingAs($ticket->user)
        ->get(route('tickets.diag', $ticket))
        ->assertForbidden();
});

it('stores a diagnostic and creates the device from the inventory sheet', function () {
    Storage::fake('local');
    $agent = diagAgent();
    $ticket = diagTicket();

    $response = $this->actingAs($agent)->post(route('tickets.diagnostics.store', $ticket), [
        'report' => diagReport(),
        'inventory' => json_encode([
            'brand' => 'MSI', 'model' => 'GL65 Leopard 10SFK', 'serial' => 'K1234',
            'os' => 'Windows 11 Home', 'ram' => '16', 'storage' => '512 Go', 'cpu' => 'Intel Core i7-10750H',
            'purchase' => 'pas une date',
        ]),
        'state' => json_encode(['checks' => ['keyboard' => 'ok'], 'notes' => 'RAS']),
        'files' => [UploadedFile::fake()->createWithContent('rapport.csv', 'a,b,c')],
        'file_sources' => ['aida'],
        'file_names' => ['rapport.csv'],
        'file_encodings' => ['plain'],
    ], ['Accept' => 'application/json']);

    $response->assertCreated()->assertJson(['device_created' => true, 'conflicts' => []]);

    $ticket->refresh();
    $device = $ticket->device;
    expect($device)->not->toBeNull()
        ->and($device->user_id)->toBe($ticket->user_id)
        ->and($device->brand)->toBe('MSI')
        ->and($device->serial_number)->toBe('K1234')
        ->and($device->ram_gb)->toBe(16)
        ->and($device->storage_gb)->toBe(512)
        ->and($device->purchase_date)->toBeNull();

    $diagnostic = Diagnostic::firstOrFail();
    expect($diagnostic->overall)->toBe('warn')
        ->and($diagnostic->viability_score)->toBe(72)
        ->and($diagnostic->device_id)->toBe($device->id)
        ->and($diagnostic->files[0]['source'])->toBe('aida');
    Storage::disk('local')->assertExists($diagnostic->files[0]['path']);

    $this->assertDatabaseHas('device_events', ['device_id' => $device->id, 'event_type' => 'diagnostic', 'ticket_id' => $ticket->id]);
    $this->assertDatabaseHas('ticket_timeline_events', ['ticket_id' => $ticket->id, 'event_type' => 'diagnostic_added']);

    $this->actingAs($agent)
        ->get(route('tickets.diagnostics.file', [$ticket, $diagnostic, 'aida']))
        ->assertOk();

    $this->actingAs($agent)
        ->get(route('tickets.diagnostics.show', [$ticket, $diagnostic]))
        ->assertOk()
        ->assertSee('"preload":{"id":'.$diagnostic->id, false);
});

it('only fills empty device fields and reports the differences', function () {
    Storage::fake('local');
    $agent = diagAgent();
    $device = Device::create([
        'user_id' => User::factory()->create()->id,
        'device_type' => 'computer',
        'brand' => 'Dell',
        'model' => 'Latitude 5490',
        'status' => 'active',
    ]);
    $ticket = diagTicket($device);

    $response = $this->actingAs($agent)->postJson(route('tickets.diagnostics.store', $ticket), [
        'report' => diagReport(),
        'inventory' => json_encode(['brand' => 'Dell Inc.', 'model' => 'Latitude 5490', 'cpu' => 'Intel Core i5-8350U']),
    ]);

    $response->assertCreated()
        ->assertJsonPath('device_created', false)
        ->assertJsonPath('filled', ['cpu'])
        ->assertJsonPath('conflicts.0.field', 'brand')
        ->assertJsonPath('conflicts.0.current', 'Dell')
        ->assertJsonPath('conflicts.0.proposed', 'Dell Inc.');

    expect($device->fresh()->brand)->toBe('Dell')
        ->and($device->fresh()->cpu)->toBe('Intel Core i5-8350U');

    $diagnostic = Diagnostic::firstOrFail();
    $this->actingAs($agent)
        ->postJson(route('tickets.diagnostics.inventory', [$ticket, $diagnostic]), ['fields' => ['brand']])
        ->assertOk()
        ->assertJsonPath('updated', ['brand']);

    expect($device->fresh()->brand)->toBe('Dell Inc.');
});

it('does not take a serial number that belongs to another client', function () {
    Storage::fake('local');
    Device::create([
        'user_id' => User::factory()->create()->id,
        'device_type' => 'computer',
        'serial_number' => 'K1234',
        'status' => 'active',
    ]);
    $ticket = diagTicket();

    $this->actingAs(diagAgent())
        ->postJson(route('tickets.diagnostics.store', $ticket), [
            'report' => diagReport(),
            'inventory' => json_encode(['brand' => 'MSI', 'serial' => 'K1234']),
        ])
        ->assertCreated()
        ->assertJsonPath('device_created', true)
        ->assertJsonCount(1, 'warnings');

    expect($ticket->fresh()->device->serial_number)->toBeNull();
});

it('shows the ticket diagnostics on the ticket page', function () {
    Storage::fake('local');
    $agent = diagAgent();
    $ticket = diagTicket();
    Diagnostic::create([
        'ticket_id' => $ticket->id,
        'technician_id' => $agent->id,
        'overall' => 'good',
        'overall_label' => 'Bon état général',
        'report' => ['format' => 'diag-atelier'],
    ]);

    $this->actingAs($agent)
        ->get(route('tickets.show', $ticket))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('diagnostics', 1)
            ->where('diagnostics.0.overall', 'good'));
});

it('deletes a diagnostic with its files and device event', function () {
    Storage::fake('local');
    $agent = diagAgent();
    $ticket = diagTicket();

    $this->actingAs($agent)->post(route('tickets.diagnostics.store', $ticket), [
        'report' => diagReport(),
        'inventory' => json_encode(['brand' => 'MSI']),
        'files' => [UploadedFile::fake()->createWithContent('log.csv', 'x')],
        'file_sources' => ['hwinfo'],
    ], ['Accept' => 'application/json'])->assertCreated();

    $diagnostic = Diagnostic::firstOrFail();

    $this->actingAs($agent)
        ->delete(route('tickets.diagnostics.destroy', [$ticket, $diagnostic]))
        ->assertRedirect();

    expect(Diagnostic::count())->toBe(0);
    Storage::disk('local')->assertMissing($diagnostic->files[0]['path']);
    $this->assertDatabaseMissing('device_events', ['event_type' => 'diagnostic', 'ticket_id' => $ticket->id]);
});

function sharedDiagReport(): string
{
    return diagReport([
        'cpu' => ['name' => 'Intel Core i7-10750H SECRET-CPU'],
        'clientReport' => [
            'verdict' => ['lvl' => 'warn', 'title' => 'Votre ordinateur fonctionne, mais montre son âge', 'text' => 'Quelques améliorations.'],
            'details' => [['id' => 'perf', 'title' => 'Rapidité', 'status' => 'good', 'text' => 'Processeur <b>adapté</b>.']],
            'advice' => [['priority' => 'reco', 'priorityLabel' => 'Recommandé', 'title' => 'Passer à un SSD', 'why' => 'Démarrage plus rapide.']],
        ],
        'notes' => 'Nettoyage effectué.',
    ]);
}

it('shares the customer sheet of a diagnostic on the ticket only once made visible', function () {
    Storage::fake('local');
    $agent = diagAgent();
    $ticket = diagTicket();
    $token = $ticket->getOrCreateMagicLink()['token'];

    $this->actingAs($agent)->post(route('tickets.diagnostics.store', $ticket), [
        'report' => sharedDiagReport(),
    ], ['Accept' => 'application/json'])->assertCreated();
    $diagnostic = Diagnostic::firstOrFail();
    expect($diagnostic->client_visible)->toBeFalse();

    $reportUrl = route('tickets.diagnostics.clientReport', [$ticket, $diagnostic]);

    // Agents can preview it, the customer cannot see it yet.
    $this->actingAs($agent)->get($reportUrl)->assertOk()->assertSee('Passer à un SSD');
    auth()->logout();
    $this->get($reportUrl.'?token='.$token)->assertNotFound();
    $this->getJson(route('tickets.files.index', $ticket).'?token='.$token)
        ->assertOk()
        ->assertJsonCount(0, 'files');

    $this->actingAs($agent)
        ->patchJson(route('tickets.diagnostics.visibility', [$ticket, $diagnostic]), ['client_visible' => true])
        ->assertOk()
        ->assertJson(['client_visible' => true]);
    $this->assertDatabaseHas('ticket_timeline_events', ['ticket_id' => $ticket->id, 'event_type' => 'diagnostic_shared']);
    auth()->logout();

    $this->getJson(route('tickets.files.index', $ticket).'?token='.$token)
        ->assertOk()
        ->assertJsonPath('files.0.source', 'diagnostic')
        ->assertJsonPath('files.0.download_path', "/tickets/{$ticket->id}/diagnostics/{$diagnostic->id}/client-report");

    $this->get($reportUrl.'?token='.$token)
        ->assertOk()
        ->assertSee('Le bilan de santé de votre ordinateur')
        ->assertSee('Processeur adapté.')
        ->assertSee('Nettoyage effectué.')
        ->assertDontSee('SECRET-CPU');
    $this->get($reportUrl)->assertForbidden();

    // Taken back: the customer loses access again.
    $this->actingAs($agent)
        ->patchJson(route('tickets.diagnostics.visibility', [$ticket, $diagnostic]), ['client_visible' => false])
        ->assertOk();
    auth()->logout();
    $this->get($reportUrl.'?token='.$token)->assertNotFound();
});

it('lets only agents change the visibility of a diagnostic', function () {
    $ticket = diagTicket();
    $diagnostic = Diagnostic::create(['ticket_id' => $ticket->id, 'report' => json_decode(sharedDiagReport(), true)]);

    $this->actingAs($ticket->user)
        ->patchJson(route('tickets.diagnostics.visibility', [$ticket, $diagnostic]), ['client_visible' => true])
        ->assertForbidden();

    expect($diagnostic->fresh()->client_visible)->toBeFalse();
});
