<?php

namespace App\Notifications;

use App\Models\Devis;
use App\Models\DevisMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class DevisMentionNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Devis $devis,
        public DevisMessage $message,
        public string $mentionedByName,
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
        return [
            'type' => 'devis_mention',
            'devis_id' => $this->devis->id,
            'devis_title' => $this->devis->title,
            'message_id' => $this->message->id,
            'mentioned_by' => $this->mentionedByName,
            'reason' => trim($this->mentionedByName . ' vous a mentionné dans un échange de devis.'),
            'excerpt' => mb_substr((string) $this->message->body, 0, 180),
            'href' => '/devis/' . $this->devis->id,
        ];
    }
}
