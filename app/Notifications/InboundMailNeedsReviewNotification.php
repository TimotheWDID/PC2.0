<?php

namespace App\Notifications;

use App\Models\InboundEmail;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class InboundMailNeedsReviewNotification extends Notification
{
    use Queueable;

    public function __construct(public InboundEmail $inboundEmail)
    {
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $sender = trim((string) ($this->inboundEmail->sender_email ?? ''));
        $subject = trim((string) ($this->inboundEmail->subject ?? ''));

        return [
            'type' => 'inbound_mail_needs_review',
            'inbound_email_id' => $this->inboundEmail->id,
            'ticket_id' => null,
            'ticket_title' => null,
            'sender_email' => $sender !== '' ? $sender : null,
            'subject' => $subject !== '' ? $subject : null,
            'reason' => 'Un mail entrant doit etre rattache manuellement a un ticket.',
            'excerpt' => mb_substr((string) ($this->inboundEmail->body_text ?? ''), 0, 180),
            'href' => '/tickets/inbound-mails',
        ];
    }
}
