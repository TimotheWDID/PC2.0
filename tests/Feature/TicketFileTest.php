<?php

use App\Mail\TicketFilesSharedMail;
use App\Models\Agent;
use App\Models\Ticket;
use App\Models\TicketFile;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

function filesAgent(): User
{
    $user = User::factory()->create();
    Agent::create(['user_id' => $user->id, 'is_admin' => false, 'is_active' => true]);

    return $user;
}

function filesTicket(string $email = 'client@example.test'): Ticket
{
    $client = User::factory()->create(['email' => $email]);

    return Ticket::create([
        'user_id' => $client->id,
        'title' => 'Ecran casse',
        'message' => 'Ecran fissure.',
        'priority' => 'medium',
        'status' => 'pending',
    ]);
}

it('lets an agent add internal and external files to a ticket', function () {
    Storage::fake('local');
    $ticket = filesTicket();

    $this->actingAs(filesAgent())
        ->postJson(route('tickets.files.store', $ticket), [
            'files' => [UploadedFile::fake()->create('devis.pdf', 120, 'application/pdf')],
            'visibility' => 'internal',
        ])
        ->assertCreated()
        ->assertJsonPath('files.0.name', 'devis.pdf')
        ->assertJsonPath('files.0.visibility', 'internal');

    $file = TicketFile::sole();
    Storage::disk('local')->assertExists($file->path);
    expect($ticket->timelineEvents()->where('event_type', 'files_added')->exists())->toBeTrue();
});

it('hides internal files from the customer', function () {
    Storage::fake('local');
    $ticket = filesTicket();
    $agent = filesAgent();

    $this->actingAs($agent)->postJson(route('tickets.files.store', $ticket), [
        'files' => [UploadedFile::fake()->create('note-interne.txt', 1, 'text/plain')],
        'visibility' => 'internal',
    ])->assertCreated();
    $this->actingAs($agent)->postJson(route('tickets.files.store', $ticket), [
        'files' => [UploadedFile::fake()->create('facture.pdf', 10, 'application/pdf')],
        'visibility' => 'external',
    ])->assertCreated();

    $internal = TicketFile::where('visibility', 'internal')->sole();
    $external = TicketFile::where('visibility', 'external')->sole();

    $this->actingAs($agent)->getJson(route('tickets.files.index', $ticket))
        ->assertOk()
        ->assertJsonCount(2, 'files');

    $this->actingAs($ticket->user)->getJson(route('tickets.files.index', $ticket))
        ->assertOk()
        ->assertJsonCount(1, 'files')
        ->assertJsonPath('files.0.name', 'facture.pdf');

    $this->actingAs($ticket->user)
        ->get(route('tickets.files.download', [$ticket, $internal]))
        ->assertForbidden();
    $this->actingAs($ticket->user)
        ->get(route('tickets.files.download', [$ticket, $external]))
        ->assertOk();
});

it('serves shared files through the magic link only', function () {
    Storage::fake('local');
    $ticket = filesTicket();
    $token = $ticket->getOrCreateMagicLink()['token'];

    $this->actingAs(filesAgent())->postJson(route('tickets.files.store', $ticket), [
        'files' => [UploadedFile::fake()->create('rapport.pdf', 10, 'application/pdf')],
        'visibility' => 'external',
    ])->assertCreated();
    auth()->logout();

    $file = TicketFile::sole();

    $this->getJson(route('tickets.files.index', $ticket).'?token='.$token)
        ->assertOk()
        ->assertJsonCount(1, 'files');
    $this->get(route('tickets.files.download', [$ticket, $file]).'?token='.$token)->assertOk();
    $this->get(route('tickets.files.download', [$ticket, $file]))->assertForbidden();
});

it('prevents customers from uploading or managing ticket files', function () {
    Storage::fake('local');
    $ticket = filesTicket();

    $this->actingAs($ticket->user)->postJson(route('tickets.files.store', $ticket), [
        'files' => [UploadedFile::fake()->create('x.pdf', 10, 'application/pdf')],
        'visibility' => 'external',
    ])->assertForbidden();
});

it('emails files to the customer and shares them', function () {
    Storage::fake('local');
    Mail::fake();
    $ticket = filesTicket();
    $agent = filesAgent();

    $this->actingAs($agent)->postJson(route('tickets.files.store', $ticket), [
        'files' => [UploadedFile::fake()->create('facture.pdf', 50, 'application/pdf')],
        'visibility' => 'internal',
    ])->assertCreated();
    $file = TicketFile::sole();

    $this->actingAs($agent)->postJson(route('tickets.files.send', $ticket), [
        'file_ids' => [$file->id],
        'email' => 'client@example.test',
        'message' => 'Voici votre facture.',
    ])
        ->assertOk()
        ->assertJsonPath('attached', true)
        ->assertJsonPath('files.0.visibility', 'external');

    Mail::assertSent(TicketFilesSharedMail::class, function (TicketFilesSharedMail $mail) {
        return $mail->hasTo('client@example.test')
            && $mail->attachFiles
            && count($mail->attachments()) === 1
            && $mail->note === 'Voici votre facture.';
    });

    $file->refresh();
    expect($file->visibility)->toBe('external')
        ->and($file->last_sent_to)->toBe('client@example.test')
        ->and($file->last_sent_at)->not->toBeNull();
});

it('refuses to send a file from another ticket', function () {
    Storage::fake('local');
    Mail::fake();
    $agent = filesAgent();
    $ticket = filesTicket();
    $other = filesTicket('autre@example.test');

    $this->actingAs($agent)->postJson(route('tickets.files.store', $other), [
        'files' => [UploadedFile::fake()->create('autre.pdf', 10, 'application/pdf')],
        'visibility' => 'external',
    ])->assertCreated();

    $this->actingAs($agent)->postJson(route('tickets.files.send', $ticket), [
        'file_ids' => [TicketFile::sole()->id],
        'email' => 'client@example.test',
    ])->assertStatus(422);

    $this->actingAs($agent)
        ->deleteJson(route('tickets.files.destroy', [$ticket, TicketFile::sole()]))
        ->assertNotFound();

    Mail::assertNothingSent();
});

it('lets an agent change visibility and delete a file', function () {
    Storage::fake('local');
    $agent = filesAgent();
    $ticket = filesTicket();

    $this->actingAs($agent)->postJson(route('tickets.files.store', $ticket), [
        'files' => [UploadedFile::fake()->create('photo.jpg', 10, 'image/jpeg')],
        'visibility' => 'internal',
    ])->assertCreated();
    $file = TicketFile::sole();

    $this->actingAs($agent)
        ->patchJson(route('tickets.files.update', [$ticket, $file]), ['visibility' => 'external'])
        ->assertOk()
        ->assertJsonPath('file.visibility', 'external');

    $this->actingAs($agent)
        ->deleteJson(route('tickets.files.destroy', [$ticket, $file]))
        ->assertOk();

    expect(TicketFile::count())->toBe(0);
    Storage::disk('local')->assertMissing($file->path);
});
