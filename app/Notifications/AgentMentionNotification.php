<?php

namespace App\Notifications;

use App\Models\Message;
use App\Models\Ticket;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class AgentMentionNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Ticket $ticket,
        public Message $message,
        public string $mentionedByName,
    ) {}

    /**
     * Get the notification's delivery channels.
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'agent_mention',
            'ticket_id' => $this->ticket->id,
            'ticket_title' => $this->ticket->title,
            'message_id' => $this->message->id,
            'mentioned_by' => $this->mentionedByName,
            'reason' => trim($this->mentionedByName . ' vous a mentionne dans une note interne.'),
            'excerpt' => mb_substr((string) $this->message->content, 0, 180),
            'href' => '/tickets/' . $this->ticket->id,
        ];
    }
}
