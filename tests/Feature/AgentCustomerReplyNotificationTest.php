<?php

use App\Models\Agent;
use App\Models\Message;
use App\Models\Ticket;
use App\Models\User;
use App\Notifications\AgentTicketReplyNotification;
use Illuminate\Support\Facades\Notification;
use function Pest\Laravel\actingAs;
use function Pest\Laravel\post;
use function Pest\Laravel\postJson;

function createAgentUser(bool $isActive = true): User
{
    $user = User::factory()->create();

    Agent::create([
        'user_id' => $user->id,
        'is_admin' => false,
        'is_active' => $isActive,
    ]);

    return $user;
}

function createTicketForCustomer(User $customer, ?int $assigneeId = null): Ticket
{
    return Ticket::create([
        'user_id' => $customer->id,
        'title' => 'Ticket test notification',
        'message' => 'Creation ticket test',
        'priority' => 'low',
        'status' => 'open',
        'assignee_id' => $assigneeId,
        'notify_by' => 'None',
    ]);
}

test('customer reply notifies only assigned active agent', function () {
    Notification::fake();

    $customer = User::factory()->create();
    $assignedAgent = createAgentUser();
    $otherAgent = createAgentUser();

    $ticket = createTicketForCustomer($customer, $assignedAgent->id);
    $magicLink = $ticket->issueMagicLink();

    postJson(route('tickets.messages.store', [
        'ticket' => $ticket->id,
        'token' => $magicLink['token'],
    ]), [
        'content' => 'Bonjour, je reponds au ticket.',
    ])->assertCreated();

    Notification::assertSentTo($assignedAgent, AgentTicketReplyNotification::class);
    Notification::assertNotSentTo($otherAgent, AgentTicketReplyNotification::class);
});

test('customer reply notifies all active agents when ticket has no assignee', function () {
    Notification::fake();

    $customer = User::factory()->create();
    $firstAgent = createAgentUser();
    $secondAgent = createAgentUser();
    $inactiveAgent = createAgentUser(false);

    $ticket = createTicketForCustomer($customer, null);
    $magicLink = $ticket->issueMagicLink();

    postJson(route('tickets.messages.store', [
        'ticket' => $ticket->id,
        'token' => $magicLink['token'],
    ]), [
        'content' => 'Client: nouveau message sur ticket non attribue.',
    ])->assertCreated();

    Notification::assertSentTo($firstAgent, AgentTicketReplyNotification::class);
    Notification::assertSentTo($secondAgent, AgentTicketReplyNotification::class);
    Notification::assertNotSentTo($inactiveAgent, AgentTicketReplyNotification::class);
});

test('validating dashboard ticket notifications only marks current agent notifications as read', function () {
    $customer = User::factory()->create();
    $agentOne = createAgentUser();
    $agentTwo = createAgentUser();

    $ticket = createTicketForCustomer($customer, null);

    $message = Message::create([
        'ticket_id' => $ticket->id,
        'author_id' => $customer->id,
        'content' => 'Reponse client importee.',
        'is_internal' => false,
        'attachments' => [],
    ]);

    $agentOne->notify(new AgentTicketReplyNotification($ticket, $message, 'Client Test'));
    $agentTwo->notify(new AgentTicketReplyNotification($ticket, $message, 'Client Test'));

    expect($agentOne->unreadNotifications()->count())->toBe(1);
    expect($agentTwo->unreadNotifications()->count())->toBe(1);

    actingAs($agentOne);

    post(route('dashboard.notifications.validate-ticket', ['ticket' => $ticket->id]))
        ->assertRedirect();

    expect($agentOne->fresh()->unreadNotifications()->count())->toBe(0);
    expect($agentTwo->fresh()->unreadNotifications()->count())->toBe(1);
});
