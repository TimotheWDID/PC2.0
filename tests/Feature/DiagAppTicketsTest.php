<?php

use App\Models\Agent;
use App\Models\Device;
use App\Models\DeviceEvent;
use App\Models\DiagAppToken;
use App\Models\Diagnostic;
use App\Models\Message;
use App\Models\Ticket;
use App\Models\TicketFile;
use App\Models\TicketTimelineEvent;
use App\Models\User;
use App\Notifications\AgentMentionNotification;
use App\Notifications\TicketMessageNotification;
use Illuminate\Http\UploadedFile;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

function dtAgent(string $first = 'Tim', string $last = 'Tech'): User
{
    $user = User::factory()->create(['first_name' => $first, 'last_name' => $last]);
    Agent::create(['user_id' => $user->id, 'is_admin' => false, 'is_active' => true]);

    return $user;
}

function dtKey(User $agent): string
{
    return DiagAppToken::issue($agent, 'Clé USB')[1];
}

function dtTicket(array $attributes = []): Ticket
{
    static $n = 0;
    $client = User::factory()->create(['first_name' => 'Claire', 'last_name' => 'Dupont', 'email' => 'claire'.(++$n > 1 ? $n : '').'@example.test']);

    return Ticket::create($attributes + [
        'user_id' => $client->id,
        'title' => 'PC portable lent',
        'message' => 'Le PC rame depuis la mise à jour.',
        'priority' => 'medium',
        'status' => 'open',
        'brought_items' => ['items' => ['computer', 'charger', 'other'], 'other' => ['Souris USB']],
    ]);
}

beforeEach(fn () => Storage::fake('local'));

it('lists tickets by scope with their pending actions', function () {
    $agent = dtAgent();
    $mine = dtTicket(['title' => 'Le mien', 'assignee_id' => $agent->id]);
    $free = dtTicket(['title' => 'Libre']);
    $done = dtTicket(['title' => 'Fini', 'status' => 'closed']);
    TicketTimelineEvent::create([
        'ticket_id' => $mine->id, 'technician_id' => $agent->id, 'event_type' => 'diagnostic', 'summary' => 'Diag',
        'details' => ['actions' => [['label' => 'Changer la RAM', 'done' => false], ['label' => 'Tester', 'done' => true]]],
        'happened_at' => now(),
    ]);
    $key = dtKey($agent);

    $this->withToken($key)->getJson('/api/diag-app/tickets?scope=mine')
        ->assertOk()->assertJsonCount(1, 'tickets')
        ->assertJsonPath('tickets.0.id', $mine->id)
        ->assertJsonPath('tickets.0.mine', true)
        ->assertJsonPath('tickets.0.pending_actions', 1)
        ->assertJsonPath('tickets.0.assignee.name', 'Tim Tech');
    $this->withToken($key)->getJson('/api/diag-app/tickets?scope=unassigned')
        ->assertJsonCount(1, 'tickets')->assertJsonPath('tickets.0.id', $free->id);
    $this->withToken($key)->getJson('/api/diag-app/tickets?scope=closed')
        ->assertJsonCount(1, 'tickets')->assertJsonPath('tickets.0.id', $done->id);
    $this->withToken($key)->getJson('/api/diag-app/tickets?scope=all&q=claire')
        ->assertJsonCount(3, 'tickets');
    $this->withToken($key)->getJson('/api/diag-app/tickets')
        ->assertJsonCount(2, 'tickets');
});

it('gives the whole ticket in one call', function () {
    $agent = dtAgent();
    $ticket = dtTicket(['assignee_id' => $agent->id]);
    $device = Device::create(['user_id' => $ticket->user_id, 'device_type' => 'laptop', 'brand' => 'HP', 'model' => 'ProBook 450', 'serial_number' => 'SN123', 'access_password' => 'azerty']);
    $ticket->update(['device_id' => $device->id]);
    Message::create(['ticket_id' => $ticket->id, 'author_id' => $agent->id, 'content' => 'Note pour l\'équipe', 'is_internal' => true]);
    Message::create(['ticket_id' => $ticket->id, 'author_id' => $ticket->user_id, 'content' => 'Merci !', 'is_internal' => false]);
    TicketFile::create(['ticket_id' => $ticket->id, 'uploaded_by' => $agent->id, 'path' => 'x/devis.pdf', 'original_name' => 'devis.pdf', 'mime_type' => 'application/pdf', 'size' => 10, 'visibility' => 'internal']);

    $this->withToken(dtKey($agent))->getJson("/api/diag-app/tickets/{$ticket->id}")
        ->assertOk()
        ->assertJsonPath('ticket.title', 'PC portable lent')
        ->assertJsonPath('ticket.message', 'Le PC rame depuis la mise à jour.')
        ->assertJsonPath('ticket.brought_items', ['Ordinateur', 'Chargeur', 'Souris USB'])
        ->assertJsonPath('ticket.device_password', 'azerty')
        ->assertJsonPath('ticket.customer.email', $ticket->user->email)
        ->assertJsonPath('ticket.device_info.serial_number', 'SN123')
        ->assertJsonCount(2, 'messages')
        ->assertJsonPath('messages.0.is_internal', true)
        ->assertJsonPath('files.0.name', 'devis.pdf')
        ->assertJsonPath('files.0.download_path', "/tickets/{$ticket->id}/files/".TicketFile::sole()->id.'/download')
        ->assertJsonPath('options.notification.channels', ['Email'])
        ->assertJsonPath('options.notification.default', 'Email')
        ->assertJsonPath('options.agents.0.mention', 'timtech')
        ->assertJson(fn ($json) => $json->has('options.event_types.0.eventType')->has('options.action_lists.0.tasks')->etc());
});

it('changes status and priority and takes the ticket, in the follow-up', function () {
    $agent = dtAgent();
    $ticket = dtTicket();
    $key = dtKey($agent);

    $this->withToken($key)->patchJson("/api/diag-app/tickets/{$ticket->id}/status", ['status' => 'in_progress'])->assertOk();
    $this->withToken($key)->patchJson("/api/diag-app/tickets/{$ticket->id}/priority", ['priority' => 'high'])->assertOk();
    $this->withToken($key)->postJson("/api/diag-app/tickets/{$ticket->id}/assign-me")->assertOk();
    $this->withToken($key)->patchJson("/api/diag-app/tickets/{$ticket->id}/status", ['status' => 'nope'])->assertUnprocessable();

    $ticket->refresh();
    expect($ticket->status)->toBe('in_progress')
        ->and($ticket->priority)->toBe('high')
        ->and($ticket->assignee_id)->toBe($agent->id)
        ->and($ticket->timelineEvents()->pluck('event_type')->sort()->values()->all())
        ->toBe(['assignee_changed', 'priority_changed', 'status_changed'])
        ->and($ticket->timelineEvents()->where('event_type', 'status_changed')->value('technician_id'))->toBe($agent->id);

    $this->withToken(dtKey(dtAgent('Paul', 'Autre')))
        ->postJson("/api/diag-app/tickets/{$ticket->id}/assign-me")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('assignee_id');
});

it('writes follow-up events, ticks their actions, removes and restores them', function () {
    $agent = dtAgent();
    $ticket = dtTicket();
    $key = dtKey($agent);

    $id = $this->withToken($key)->postJson("/api/diag-app/tickets/{$ticket->id}/timeline-events", [
        'event_type' => 'diagnostic',
        'summary' => 'Diagnostic fait avec PC2 Diag',
        'details' => 'Disque fatigué.',
        'actions' => [['label' => 'Cloner le disque', 'done' => false], ['label' => 'Analyse', 'done' => true]],
    ])->assertCreated()->json('event_id');

    $event = TicketTimelineEvent::find($id);
    expect($event->details['note'])->toBe('Disque fatigué.')
        ->and($event->details['actions'][1]['done_by_name'])->toBe('Tim Tech')
        ->and(TicketTimelineEvent::where('event_type', 'task_completed')->count())->toBe(1);

    $this->withToken($key)->getJson('/api/diag-app/todos')
        ->assertOk()->assertJsonCount(1, 'todos')
        ->assertJsonPath('todos.0.action.label', 'Cloner le disque');

    $this->withToken($key)->patchJson("/api/diag-app/tickets/{$ticket->id}/timeline-events/{$id}/actions", ['action_index' => 0, 'done' => true])->assertOk();
    expect($event->fresh()->details['actions'][0]['done'])->toBeTrue();
    $this->withToken($key)->getJson('/api/diag-app/todos')->assertJsonCount(0, 'todos');
    $this->withToken($key)->patchJson("/api/diag-app/tickets/{$ticket->id}/timeline-events/{$id}/actions", ['action_index' => 9, 'done' => true])->assertUnprocessable();

    $this->withToken($key)->deleteJson("/api/diag-app/tickets/{$ticket->id}/timeline-events/{$id}", ['reason' => 'Doublon'])->assertOk();
    expect($event->fresh()->trashed())->toBeTrue()->and($event->fresh()->removed_reason)->toBe('Doublon');
    $this->withToken($key)->getJson("/api/diag-app/tickets/{$ticket->id}")
        ->assertJson(fn ($json) => $json->where('timeline', fn ($t) => collect($t)->firstWhere('id', $id)['is_removed'] === true)->etc());
    $this->withToken($key)->patchJson("/api/diag-app/tickets/{$ticket->id}/timeline-events/{$id}/restore")->assertOk();
    expect($event->fresh()->trashed())->toBeFalse();

    $other = dtTicket();
    $this->withToken($key)->deleteJson("/api/diag-app/tickets/{$other->id}/timeline-events/{$id}")->assertNotFound();
});

it('adds work on the ticket device', function () {
    $agent = dtAgent();
    $ticket = dtTicket();
    $key = dtKey($agent);
    $payload = ['event_type' => 'battery_replaced', 'summary' => 'Batterie remplacée'];

    $this->withToken($key)->postJson("/api/diag-app/tickets/{$ticket->id}/device-events", $payload)
        ->assertUnprocessable()->assertJsonValidationErrors('device');

    $ticket->update(['device_id' => Device::create(['user_id' => $ticket->user_id, 'device_type' => 'laptop', 'brand' => 'HP'])->id]);
    $this->withToken($key)->postJson("/api/diag-app/tickets/{$ticket->id}/device-events", $payload)->assertCreated();

    expect(DeviceEvent::sole()->summary)->toBe('Batterie remplacée')
        ->and($ticket->timelineEvents()->where('event_type', 'device_event_added')->exists())->toBeTrue();
    $this->withToken($key)->getJson("/api/diag-app/tickets/{$ticket->id}")
        ->assertJsonPath('device_events.0.summary', 'Batterie remplacée')
        ->assertJsonPath('device_events.0.technician', 'Tim Tech');
});

it('replies to the customer, writes internal notes with mentions, and serves attachments', function () {
    Notification::fake();
    $agent = dtAgent();
    $colleague = dtAgent('Sarah', 'Martin');
    $ticket = dtTicket();
    $key = dtKey($agent);

    $this->withToken($key)->postJson("/api/diag-app/tickets/{$ticket->id}/messages", [
        'content' => 'Votre PC est prêt.',
        'notification_channel' => 'Email',
    ])->assertCreated()->assertJsonPath('meta.notification_channel', 'Email');
    Notification::assertSentTo(new AnonymousNotifiable, TicketMessageNotification::class);
    expect($ticket->timelineEvents()->where('event_type', 'public_reply_added')->exists())->toBeTrue();

    $res = $this->withToken($key)->post("/api/diag-app/tickets/{$ticket->id}/messages", [
        'content' => '@sarahmartin peux-tu commander la RAM ?',
        'is_internal' => '1',
        'attachments' => [UploadedFile::fake()->create('facture.pdf', 20, 'application/pdf')],
    ])->assertCreated();
    Notification::assertSentTo($colleague, AgentMentionNotification::class);
    expect(Message::latest('id')->first()->is_internal)->toBeTrue();

    $path = $res->json('message.file_attachments.0.download_path');
    $this->withToken($key)->get('/api/diag-app'.$path)->assertOk()->assertDownload('facture.pdf');

    $mid = $res->json('message.id');
    $this->withToken($key)->postJson("/api/diag-app/tickets/{$ticket->id}/messages/{$mid}/validate-mention")->assertOk();
    $this->withToken($key)->deleteJson("/api/diag-app/tickets/{$ticket->id}/messages/{$mid}")->assertOk();
    expect(Message::find($mid))->toBeNull();

    $this->withToken($key)->postJson("/api/diag-app/tickets/{$ticket->id}/messages", ['content' => 'x', 'notification_channel' => 'SMS'])
        ->assertUnprocessable();
});

it('adds, shares, downloads and deletes ticket files', function () {
    $agent = dtAgent();
    $ticket = dtTicket();
    $key = dtKey($agent);

    $file = $this->withToken($key)->post("/api/diag-app/tickets/{$ticket->id}/files", [
        'files' => [UploadedFile::fake()->create('rapport.txt', 2, 'text/plain')],
        'visibility' => 'internal',
    ])->assertCreated()->json('files.0');

    $this->withToken($key)->get('/api/diag-app'.$file['download_path'])->assertOk()->assertDownload('rapport.txt');
    $this->withToken($key)->patchJson("/api/diag-app/tickets/{$ticket->id}/files/{$file['id']}", ['visibility' => 'external'])
        ->assertOk()->assertJsonPath('file.visibility', 'external');
    $this->withToken($key)->deleteJson("/api/diag-app/tickets/{$ticket->id}/files/{$file['id']}")->assertOk();
    expect(TicketFile::count())->toBe(0);
});

it('shares a diagnostic with the customer and shows its customer sheet', function () {
    $agent = dtAgent();
    $ticket = dtTicket();
    $diagnostic = Diagnostic::create(['ticket_id' => $ticket->id, 'technician_id' => $agent->id, 'machine_name' => 'HP ProBook', 'overall' => 'warn',
        'report' => ['format' => 'diag-app', 'machine' => ['name' => 'HP ProBook'], 'findings' => []]]);
    $key = dtKey($agent);

    $this->withToken($key)->getJson("/api/diag-app/tickets/{$ticket->id}")
        ->assertJsonPath('diagnostics.0.client_visible', false)
        ->assertJsonPath('diagnostics.0.client_report_path', "/tickets/{$ticket->id}/diagnostics/{$diagnostic->id}/client-report");
    $this->withToken($key)->patchJson("/api/diag-app/tickets/{$ticket->id}/diagnostics/{$diagnostic->id}/visibility", ['client_visible' => true])
        ->assertOk()->assertJsonPath('client_visible', true);
    $this->withToken($key)->get("/api/diag-app/tickets/{$ticket->id}/diagnostics/{$diagnostic->id}/client-report")->assertOk();
});

it('keeps the ticket page working through the shared workflow', function () {
    $agent = dtAgent();
    $other = dtAgent('Paul', 'Autre');
    $ticket = dtTicket(['assignee_id' => $other->id]);

    $this->actingAs($agent)->patch(route('tickets.updateStatus', $ticket), ['status' => 'pending'])->assertRedirect();
    $this->actingAs($agent)->patch(route('tickets.selfAssign', $ticket))->assertSessionHasErrors('assignee_id');
    $this->actingAs($agent)->post(route('tickets.timelineEvents.store', $ticket), ['event_type' => 'manual_note', 'summary' => 'Point'])
        ->assertSessionHasNoErrors();

    expect($ticket->fresh()->status)->toBe('pending')
        ->and($ticket->timelineEvents()->pluck('event_type')->sort()->values()->all())->toBe(['manual_note', 'status_changed']);
});

it('finds the open tickets of the PC the application runs on', function () {
    $agent = dtAgent();
    $byDevice = dtTicket(['title' => 'Par appareil']);
    $byDevice->update(['device_id' => Device::create(['user_id' => $byDevice->user_id, 'device_type' => 'laptop', 'serial_number' => 'sn-777'])->id]);
    $byDiag = dtTicket(['title' => 'Par diagnostic']);
    Diagnostic::create(['ticket_id' => $byDiag->id, 'technician_id' => $agent->id, 'machine_name' => 'AUTRE-NOM', 'report' => ['format' => 'diag-app'], 'inventory' => ['serial' => 'SN-777']]);
    $byName = dtTicket(['title' => 'Par nom']);
    Diagnostic::create(['ticket_id' => $byName->id, 'technician_id' => $agent->id, 'machine_name' => 'desktop-abc', 'report' => ['format' => 'diag-app']]);
    $otherPc = dtTicket(['title' => 'Autre PC, même nom']);
    Diagnostic::create(['ticket_id' => $otherPc->id, 'technician_id' => $agent->id, 'machine_name' => 'DESKTOP-ABC', 'report' => ['format' => 'diag-app'], 'inventory' => ['serial' => 'SN-999']]);
    $closed = dtTicket(['title' => 'Fermé', 'status' => 'closed']);
    $closed->update(['device_id' => Device::create(['user_id' => $closed->user_id, 'device_type' => 'laptop', 'serial_number' => 'SN-777B'])->id]);
    Diagnostic::create(['ticket_id' => $closed->id, 'technician_id' => $agent->id, 'machine_name' => 'DESKTOP-ABC', 'report' => ['format' => 'diag-app'], 'inventory' => ['serial' => 'SN-777']]);
    $key = dtKey($agent);

    $response = $this->withToken($key)->getJson('/api/diag-app/tickets/for-machine?serial=SN-777&computer=DESKTOP-ABC&ticket='.$closed->id)
        ->assertOk()
        ->assertJsonPath('serial', 'SN-777')
        ->assertJsonPath('current.id', $closed->id)
        ->assertJsonPath('current.open', false)
        ->assertJsonCount(3, 'tickets');
    $found = collect($response->json('tickets'))->mapWithKeys(fn ($t) => [$t['title'] => [$t['match']['by'], $t['match']['strong']]])->all();
    expect($found)->toBe([
        'Par appareil' => ['device', true],
        'Par diagnostic' => ['diagnostic', true],
        'Par nom' => ['name', false],
    ]);

    // a placeholder serial identifies no PC: only the name is used
    $this->withToken($key)->getJson('/api/diag-app/tickets/for-machine?serial=To%20be%20filled%20by%20O.E.M.&computer=nobody')
        ->assertJsonPath('serial', null)->assertJsonCount(0, 'tickets');
});

it('writes the application follow-up once, and finds the PC by it later', function () {
    $agent = dtAgent();
    $ticket = dtTicket();
    $key = dtKey($agent);
    $payload = [
        'machine' => ['serial' => 'PF3XYZ', 'computer' => 'PC-CLAIRE', 'model' => 'Lenovo ThinkPad'],
        'entries' => [
            ['uid' => 'a1', 'kind' => 'session', 'summary' => 'PC2 Diag lancé sur PC-CLAIRE', 'happened_at' => '2026-10-22T09:00:00+02:00'],
            ['uid' => 'a2', 'kind' => 'repair', 'summary' => 'Réparation : Nettoyage du disque — réussie', 'note' => '2,3 Go libérés'],
        ],
    ];

    $this->withToken($key)->postJson("/api/diag-app/tickets/{$ticket->id}/activity", $payload)
        ->assertCreated()->assertJsonPath('written', 2);
    $this->withToken($key)->postJson("/api/diag-app/tickets/{$ticket->id}/activity", $payload)
        ->assertCreated()->assertJsonPath('written', 0);

    $events = $ticket->timelineEvents()->where('event_type', 'diag_app_activity')->orderBy('id')->get();
    expect($events)->toHaveCount(2)
        ->and($events[0]->technician_id)->toBe($agent->id)
        ->and($events[0]->happened_at->format('Y-m-d H:i'))->toBe('2026-10-22 07:00')
        ->and($events[1]->details)->toMatchArray(['note' => '2,3 Go libérés', 'source' => 'diag_app', 'kind' => 'repair', 'machine' => ['serial' => 'PF3XYZ', 'computer' => 'PC-CLAIRE', 'model' => 'Lenovo ThinkPad']]);

    $this->withToken($key)->getJson('/api/diag-app/tickets/for-machine?serial=pf3xyz&computer=RENAMED')
        ->assertJsonCount(1, 'tickets')
        ->assertJsonPath('tickets.0.id', $ticket->id)
        ->assertJsonPath('tickets.0.match.by', 'app');
    $this->withToken($key)->getJson("/api/diag-app/tickets/{$ticket->id}")
        ->assertJsonPath('timeline.0.event_type', 'diag_app_activity');

    $this->withToken($key)->postJson("/api/diag-app/tickets/{$ticket->id}/activity", ['entries' => [['kind' => 'x']]])
        ->assertUnprocessable()->assertJsonValidationErrors('entries.0.summary');
});

it('creates a ticket for the PC from the application, for an existing or a new customer', function () {
    Notification::fake();
    $agent = dtAgent();
    $client = User::factory()->create(['first_name' => 'Paul', 'last_name' => 'Martin', 'email' => 'paul@example.test', 'phone' => '0600000000']);
    $known = Device::create(['user_id' => $client->id, 'device_type' => 'laptop', 'brand' => 'Dell', 'model' => 'Latitude', 'serial_number' => 'DL-42']);
    $key = dtKey($agent);

    $this->withToken($key)->getJson('/api/diag-app/tickets/create?q=mart')
        ->assertOk()
        ->assertJsonPath('customers.0.id', $client->id)
        ->assertJsonPath('customers.0.devices.0.serial_number', 'DL-42')
        ->assertJsonPath('brought_items.0.key', 'computer');

    // existing customer: the PC's device on their file is used
    $response = $this->withToken($key)->postJson('/api/diag-app/tickets', [
        'user_selection' => 'existing', 'user_id' => $client->id, 'title' => 'Écran noir', 'message' => 'Ne démarre plus',
        'brought_items' => ['computer', 'charger'], 'no_device_password' => true, 'password_empty_confirmed' => true,
        'notify_by' => 'SMS', 'priority' => 'high', 'assign_to_me' => true,
        'machine' => ['brand' => 'DELL', 'model' => 'Latitude 5520', 'serial' => 'dl-42'],
    ])->assertCreated()->assertJsonPath('ticket.title', 'Écran noir')->assertJsonPath('ticket.mine', true);
    $ticket = Ticket::find($response->json('ticket.id'));
    expect($ticket->device_id)->toBe($known->id)
        ->and($ticket->priority)->toBe('high')
        ->and($ticket->status)->toBe('open')
        ->and($ticket->notify_by)->toBe('SMS')
        ->and($ticket->timelineEvents()->pluck('event_type')->all())->toContain('ticket_created_by_technician');

    // new customer: the PC becomes their device; a serial already used elsewhere is left out
    $response = $this->withToken($key)->postJson('/api/diag-app/tickets', [
        'user_selection' => 'new', 'user_first_name' => 'Léa', 'user_last_name' => 'Petit', 'user_phone' => '0611111111',
        'title' => 'Virus', 'device_password' => '1234',
        'machine' => ['brand' => 'HP', 'model' => 'Pavilion 15', 'serial' => 'DL-42'],
    ])->assertCreated()->assertJsonCount(1, 'warnings');
    $ticket = Ticket::with(['device', 'user'])->find($response->json('ticket.id'));
    expect($ticket->user->first_name)->toBe('Léa')
        ->and($ticket->device->model)->toBe('Pavilion 15')
        ->and($ticket->device->serial_number)->toBeNull()
        ->and($ticket->device_password)->toBe('1234');

    $this->withToken($key)->postJson('/api/diag-app/tickets', ['user_selection' => 'new', 'user_first_name' => 'Léa', 'title' => 'X'])
        ->assertUnprocessable()->assertJsonValidationErrors('device_password');
    $this->withToken($key)->postJson('/api/diag-app/tickets', ['user_selection' => 'existing', 'title' => 'X', 'device_password' => 'a'])
        ->assertUnprocessable()->assertJsonValidationErrors('user_id');
});

it('still refuses a ticket without password on the site form', function () {
    $agent = dtAgent();
    $client = User::factory()->create();

    $this->actingAs($agent)->from('/tickets/create')->post('/tickets', ['user_selection' => 'existing', 'user_id' => $client->id, 'title' => 'Test'])
        ->assertRedirect('/tickets/create')
        ->assertSessionHasErrors('device_password');
    $this->actingAs($agent)->post('/tickets', ['user_selection' => 'existing', 'user_id' => $client->id, 'title' => 'Test', 'device_password' => 'x'])
        ->assertRedirect(route('dashboard'));
    expect(Ticket::where('title', 'Test')->exists())->toBeTrue();
});

it('gives back the PC2 Diag analysis a diagnostic was built from, to reopen it on another PC', function () {
    $agent = dtAgent();
    $ticket = dtTicket();
    $diagnostic = Diagnostic::create(['ticket_id' => $ticket->id, 'technician_id' => $agent->id, 'machine_name' => 'PC-CLAIRE', 'report' => ['format' => 'diag-atelier']]);
    $path = $diagnostic->storageDirectory().'/app.txt.gz';
    Storage::disk('local')->put($path, gzencode('{"meta":{"computer":"PC-CLAIRE"}}'));
    $diagnostic->update(['files' => [['source' => 'app', 'name' => 'Analyse.json', 'encoding' => 'gzip', 'path' => $path, 'size' => 40]]]);
    $old = Diagnostic::create(['ticket_id' => $ticket->id, 'technician_id' => $agent->id, 'machine_name' => 'Ancien', 'report' => ['format' => 'diag-app']]);
    $key = dtKey($agent);

    $diagnostics = collect($this->withToken($key)->getJson("/api/diag-app/tickets/{$ticket->id}")->json('diagnostics'))->keyBy('id');
    expect($diagnostics[$diagnostic->id]['app_scan_path'])->toBe("/tickets/{$ticket->id}/diagnostics/{$diagnostic->id}/files/app")
        ->and($diagnostics[$old->id]['app_scan_path'])->toBeNull();

    $response = $this->withToken($key)->get("/api/diag-app/tickets/{$ticket->id}/diagnostics/{$diagnostic->id}/files/app")->assertOk();
    expect(gzdecode($response->streamedContent()))->toBe('{"meta":{"computer":"PC-CLAIRE"}}');
    $this->withToken($key)->get("/api/diag-app/tickets/{$ticket->id}/diagnostics/{$old->id}/files/app")->assertNotFound();
});
