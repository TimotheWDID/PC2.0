<?php

namespace App\Notifications;

use App\Models\User;
use App\Models\Ticket;
use App\Models\Message;
use App\Support\MailFooterSettings;
use App\Notifications\Channels\SmsFactoryChannel;
use App\Notifications\Messages\SmsFactoryMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

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
        $preference = $this->resolveNotificationPreference($notifiable);
        $phone = $this->resolveSmsPhone($notifiable);
        $email = is_string($notifiable->email ?? null) ? trim((string) $notifiable->email) : null;
        $smsAvailable = $this->isSmsChannelAvailable() && $phone !== null;

        if ($preference === 'None') {
            return [];
        }

        if ($preference === 'SMS' && $smsAvailable) {
            return [SmsFactoryChannel::class];
        }

        if ($preference === 'Email' && ! empty($email)) {
            return ['mail'];
        }

        // Fallback to avoid dropping the notification if the preferred channel is unavailable.
        if ($smsAvailable) {
            return [SmsFactoryChannel::class];
        }

        if (! empty($email)) {
            return ['mail'];
        }

        return [];
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
                'mailFooter' => MailFooterSettings::load(),
            ]);
    }

    public function toSmsFactory(object $notifiable): ?SmsFactoryMessage
    {
        $recipient = $this->resolveSmsPhone($notifiable);

        if ($recipient === null) {
            return null;
        }

        $kindLabel = $this->getTicketKindLabel();
        $title = Str::limit((string) ($this->ticket->title ?? ''), 70, '...');
        $excerpt = Str::limit(
            trim(preg_replace('/\s+/u', ' ', strip_tags((string) ($this->message->content ?? ''))) ?? ''),
            120,
            '...'
        );

        $content = "[{$kindLabel}] Ticket #{$this->ticket->id}: {$title}";
        if ($excerpt !== '') {
            $content .= " - {$excerpt}";
        }

        return (new SmsFactoryMessage($content))
            ->to($recipient);
    }

    private function resolveNotificationPreference(object $notifiable): string
    {
        $ticketPreference = is_string($this->ticket->notify_by ?? null)
            ? trim((string) $this->ticket->notify_by)
            : '';

        if (in_array($ticketPreference, ['SMS', 'Email', 'None'], true)) {
            return $ticketPreference;
        }

        if ($notifiable instanceof User) {
            $userPreference = is_string($notifiable->default_notification_preference ?? null)
                ? trim((string) $notifiable->default_notification_preference)
                : '';

            if (in_array($userPreference, ['SMS', 'Email', 'None'], true)) {
                return $userPreference;
            }
        }

        return 'None';
    }

    private function resolveSmsPhone(object $notifiable): ?string
    {
        $candidate = trim((string) ($this->ticket->contact_phone ?: ($notifiable->phone ?? '')));

        return $candidate !== '' ? $candidate : null;
    }

    private function isSmsChannelAvailable(): bool
    {
        return (bool) config('services.smsfactory.enabled', false)
            && ! empty(config('services.smsfactory.api_key'));
    }
}
