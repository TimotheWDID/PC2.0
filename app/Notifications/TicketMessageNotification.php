<?php

namespace App\Notifications;

use App\Models\Ticket;
use App\Models\Message;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TicketMessageNotification extends Notification implements ShouldQueue
{
    use Queueable;

    private function getTicketKindLabel(): string
    {
        return match ($this->ticket->ticket_kind) {
            'bug' => 'Bug',
            'improvement' => 'Amelioration',
            default => 'Support',
        };
    }

    public function __construct(
        public Ticket $ticket,
        public Message $message
    ) {}

    /**
     * Get the notification's delivery channels.
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $kindLabel = $this->getTicketKindLabel();

        return (new MailMessage)
            ->subject("[{$kindLabel}] Ticket #{$this->ticket->id}: {$this->ticket->title}")
            ->markdown('emails.tickets.message', [
                'user' => $notifiable,
                'ticket' => $this->ticket,
                'messageBody' => $this->message->content,
                'ticketKindLabel' => $kindLabel,
            ]);
    }
}
