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
