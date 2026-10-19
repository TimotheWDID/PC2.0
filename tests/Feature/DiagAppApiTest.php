<?php

use App\Models\Agent;
use App\Models\Device;
use App\Models\DiagAppToken;
use App\Models\Diagnostic;
use App\Models\Ticket;
use App\Models\TicketTimelineEvent;
use App\Models\User;

function diagAppAgent(bool $active = true): User
{
    $user = User::factory()->create(['first_name' => 'Tim', 'last_name' => 'Tech']);
    Agent::create(['user_id' => $user->id, 'is_admin' => false, 'is_active' => $active]);

    return $user;
}

function diagAppTicket(?User $client = null, string $status = 'pending'): Ticket
{
    $client ??= User::factory()->create(['first_name' => 'Claire', 'last_name' => 'Dupont']);

    return Ticket::create([
        'user_id' => $client->id,
        'title' => 'PC portable lent',
        'message' => 'Le PC rame.',
        'priority' => 'medium',
        'status' => $status,
    ]);
}

function diagAppReport(): array
{
    return [
        'report' => [
            'format' => 'diag-app',
            'version' => '1.0.0',
            'machine' => ['name' => 'HP ProBook 450 G8'],
            'status' => ['overall' => 'warn', 'overallLabel' => '2 points à surveiller'],
            'viability' => ['score' => 68, 'level' => 'warn', 'verdict' => 'PC réparable'],
            'findings' => [
                ['level' => 'warn', 'category' => 'Stockage', 'title' => 'Disque C: presque plein', 'detail' => '4 Go libres', 'advice' => 'Faire du ménage.'],
            ],
            'data' => [
                'meta' => ['computer' => 'PC-CLAIRE', 'manufacturer' => 'HP', 'model' => 'HP ProBook 450 G8', 'serial' => '5CD1234XYZ'],
                'disks' => [['name' => 'Samsung SSD 980', 'sizeGB' => 476.9, 'health' => 'Healthy', 'wear' => 3]],
            ],
        ],
        'inventory' => ['brand' => 'HP', 'model' => 'HP ProBook 450 G8', 'serial' => '5CD1234XYZ', 'ram' => '16', 'os' => 'Windows 11 Professionnel'],
    ];
}

it('rejects calls without a valid key', function () {
    $this->getJson('/api/diag-app/me')->assertUnauthorized();
    $this->withToken('pc2d_nope')->getJson('/api/diag-app/me')->assertUnauthorized();

    [, $plain] = DiagAppToken::issue(diagAppAgent(false), 'Clé USB');
    $this->withToken($plain)->getJson('/api/diag-app/me')->assertForbidden();
});

it('lets an agent pair the app from the quick diag page and revoke it', function () {
    $agent = diagAppAgent();

    $this->actingAs($agent)
        ->post(route('diag.app-tokens.store'), ['name' => 'Clé USB atelier'])
        ->assertRedirect(route('diag.index'))
        ->assertSessionHas('diag_app_token');

    $plain = session('diag_app_token');
    $token = DiagAppToken::sole();
    expect($token->name)->toBe('Clé USB atelier')
        ->and($token->token_hash)->toBe(hash('sha256', $plain))
        ->and($plain)->toStartWith('pc2d_');

    $this->withToken($plain)
        ->withHeader('X-Diag-Machine', 'PC-CLAIRE')
        ->getJson('/api/diag-app/me')
        ->assertOk()
        ->assertJson(['user' => 'Tim Tech', 'key_name' => 'Clé USB atelier']);
    expect($token->fresh()->last_machine)->toBe('PC-CLAIRE');

    $this->actingAs($agent)
        ->get(route('diag.index'))
        ->assertInertia(fn ($page) => $page->has('app.tokens', 1)->where('app.tokens.0.last_machine', 'PC-CLAIRE'));

    $other = diagAppAgent();
    $this->actingAs($other)->delete(route('diag.app-tokens.destroy', $token))->assertNotFound();

    $this->actingAs($agent)->delete(route('diag.app-tokens.destroy', $token))->assertRedirect();
    $this->withToken($plain)->getJson('/api/diag-app/me')->assertUnauthorized();

    $client = User::factory()->create();
    $this->actingAs($client)->post(route('diag.app-tokens.store'))->assertForbidden();
});

it('searches open tickets by number, title or client', function () {
    [, $plain] = DiagAppToken::issue(diagAppAgent(), 'App');
    $ticket = diagAppTicket();
    $closed = diagAppTicket(status: 'closed');

    $this->withToken($plain)->getJson('/api/diag-app/tickets?q=dupont')
        ->assertOk()
        ->assertJsonCount(1, 'tickets')
        ->assertJsonPath('tickets.0.id', $ticket->id)
        ->assertJsonPath('tickets.0.client', 'Claire Dupont');

    $this->withToken($plain)->getJson('/api/diag-app/tickets?q=%23'.$closed->id)
        ->assertJsonPath('tickets.0.id', $closed->id);

    $this->withToken($plain)->getJson('/api/diag-app/tickets/'.$ticket->id)
        ->assertOk()
        ->assertJsonPath('ticket.title', 'PC portable lent');
});

it('saves a diagnostic on a ticket and fills its device', function () {
    $agent = diagAppAgent();
    [, $plain] = DiagAppToken::issue($agent, 'App');
    $ticket = diagAppTicket();

    $response = $this->withToken($plain)
        ->postJson('/api/diag-app/diagnostics', diagAppReport() + ['ticket_id' => $ticket->id])
        ->assertCreated()
        ->assertJsonPath('ticket.id', $ticket->id)
        ->assertJsonPath('device_created', true);

    $diagnostic = Diagnostic::sole();
    expect($diagnostic->ticket_id)->toBe($ticket->id)
        ->and($diagnostic->technician_id)->toBe($agent->id)
        ->and($diagnostic->overall)->toBe('warn')
        ->and($diagnostic->viability_score)->toBe(68)
        ->and($diagnostic->machine_name)->toBe('HP ProBook 450 G8');

    $device = Device::sole();
    expect($device->serial_number)->toBe('5CD1234XYZ')
        ->and($device->ram_gb)->toBe(16)
        ->and($ticket->fresh()->device_id)->toBe($device->id);
    expect(TicketTimelineEvent::where('event_type', 'diagnostic_added')->count())->toBe(1);

    $this->actingAs($agent)
        ->get(parse_url($response->json('report_url'), PHP_URL_PATH))
        ->assertOk()
        ->assertSee('Disque C: presque plein')
        ->assertSee('Samsung SSD 980')
        ->assertSee('5CD1234XYZ');
});

it('saves a diagnostic without ticket as a quick diag', function () {
    $agent = diagAppAgent();
    [, $plain] = DiagAppToken::issue($agent, 'App');

    $payload = diagAppReport();
    $payload['report']['actions'] = [
        ['id' => 'sfc', 'title' => 'Vérifier les fichiers système (SFC)', 'ok' => true, 'at' => '2026-10-19T09:30:00Z'],
        ['id' => 'dism', 'title' => 'Réparer l\'image Windows (DISM)', 'ok' => false, 'at' => 'pas une date'],
    ];
    $response = $this->withToken($plain)
        ->postJson('/api/diag-app/diagnostics', $payload)
        ->assertCreated()
        ->assertJsonPath('ticket', null);

    expect(Diagnostic::sole()->ticket_id)->toBeNull();

    $this->actingAs($agent)
        ->get(parse_url($response->json('report_url'), PHP_URL_PATH))
        ->assertOk()
        ->assertSee('HP ProBook 450 G8')
        ->assertSee('Diag rapide')
        ->assertSee('Vérifier les fichiers système (SFC)')
        ->assertSee('Échec ou annulée');

    $this->withToken($plain)
        ->postJson('/api/diag-app/diagnostics', ['report' => ['format' => 'autre']])
        ->assertUnprocessable();
    $this->withToken($plain)
        ->postJson('/api/diag-app/diagnostics', diagAppReport() + ['ticket_id' => 999999])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('ticket_id');
});

it('saves what the app sends in the Diag Atelier format, with its scan, and reopens it in the Diag Atelier', function () {
    Illuminate\Support\Facades\Storage::fake('local');
    $agent = diagAppAgent();
    [, $plain] = DiagAppToken::issue($agent, 'App');
    $ticket = diagAppTicket();

    $scan = json_encode(['meta' => ['computer' => 'PC-CLAIRE', 'manufacturer' => 'LENOVO'], 'disks' => []]);
    $report = [
        'format' => 'diag-atelier',
        'formatVersion' => 1,
        'sources' => ['app' => true, 'aida' => false, 'hwinfo' => false, 'battery' => false],
        'machine' => ['name' => 'LENOVO IdeaPad 5 14ALC05'],
        'status' => ['overall' => 'warn', 'overallLabel' => 'Quelques points à surveiller'],
        'viability' => ['score' => 92, 'level' => 'good', 'verdict' => 'PC viable'],
    ];

    $response = $this->withToken($plain)
        ->post('/api/diag-app/diagnostics', [
            'ticket_id' => $ticket->id,
            'report' => json_encode($report),
            'inventory' => json_encode(['brand' => 'LENOVO', 'serial' => 'PF2ABCDE']),
            'state' => json_encode(['checks' => ['ecran' => 'ok'], 'notes' => 'RAS']),
            'files' => [Illuminate\Http\UploadedFile::fake()->createWithContent('app.gz', gzencode($scan))],
            'file_sources' => ['app'],
            'file_names' => ['Analyse_2026-10-19_10h00m00s_PC-CLAIRE.json'],
            'file_encodings' => ['gzip'],
        ], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('ticket.id', $ticket->id);

    $diagnostic = Diagnostic::sole();
    expect($diagnostic->ticket_id)->toBe($ticket->id)
        ->and($diagnostic->viability_score)->toBe(92)
        ->and($diagnostic->state['notes'])->toBe('RAS')
        ->and($diagnostic->files[0]['source'])->toBe('app')
        ->and(Device::sole()->serial_number)->toBe('PF2ABCDE')
        ->and(TicketTimelineEvent::where('event_type', 'diagnostic_added')->sole()->summary)->toContain('PC2 Diag');

    $this->actingAs($agent)
        ->get(parse_url($response->json('report_url'), PHP_URL_PATH))
        ->assertOk()
        ->assertSee('window.DIAG_TICKET', false)
        ->assertSee('"source":"app"', false);

    $file = $this->actingAs($agent)->get(route('tickets.diagnostics.file', [$ticket, $diagnostic, 'app'], false))->assertOk();
    expect(gzdecode($file->streamedContent()))->toBe($scan);
});
