<?php

namespace App\Notifications;

use App\Models\Message;
use App\Models\Ticket;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class AgentTicketReplyNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Ticket $ticket,
        public Message $message,
        public ?string $customerName = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $name = trim((string) $this->customerName);

        return [
            'type' => 'ticket_customer_reply',
            'ticket_id' => $this->ticket->id,
            'ticket_title' => $this->ticket->title,
            'message_id' => $this->message->id,
            'customer_name' => $name !== '' ? $name : null,
            'reason' => $name !== ''
                ? $name . ' a repondu au ticket.'
                : 'Le client a repondu au ticket.',
            'excerpt' => mb_substr((string) $this->message->content, 0, 180),
            'href' => '/tickets/' . $this->ticket->id,
        ];
    }
}
