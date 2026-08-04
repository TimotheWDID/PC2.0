<?php

namespace App\Notifications;

use App\Models\User;
use App\Models\Ticket;
use App\Models\Message;
use App\Support\MailFooterSettings;
use App\Support\Sms\PhoneNumber;
use App\Support\Sms\SmsComposer;
use App\Support\Sms\SmsSettings;
use App\Notifications\Channels\SmsFactoryChannel;
use App\Notifications\Messages\SmsFactoryMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TicketMessageNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(
        public Ticket $ticket,
        public Message $message,
        public ?string $magicLinkUrl = null,
        public array $smsContext = []
    ) {}

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [15, 60, 180];
    }

    /**
     * Get the notification's delivery channels.
     */
    public function via(object $notifiable): array
    {
        $preference = $this->resolveNotificationPreference($notifiable);

        if ($preference === 'SMS') {
            $settings = SmsSettings::load();
            $phone = $this->resolveSmsPhone($notifiable, $settings);

            return SmsSettings::isEnabled($settings) && $phone !== null
                ? [SmsFactoryChannel::class]
                : [];
        }

        if ($preference === 'Email') {
            return $this->resolveEmailAddress($notifiable) !== null ? ['mail'] : [];
        }

        return [];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $kindLabel = $this->getTicketKindLabel();
        $recipientFirstName = trim((string) ($this->ticket->user?->first_name ?? ''));

        if ($recipientFirstName === '') {
            $recipientFirstName = 'client';
        }

        return (new MailMessage)
            ->subject("[{$kindLabel}] Ticket #{$this->ticket->id}: {$this->ticket->title}")
            ->markdown('emails.tickets.message', [
                'user' => $notifiable,
                'recipientFirstName' => $recipientFirstName,
                'ticket' => $this->ticket,
                'messageBody' => $this->message->content,
                'magicLinkUrl' => $this->magicLinkUrl,
                'ticketKindLabel' => $kindLabel,
                'mailFooter' => MailFooterSettings::load(),
            ]);
    }

    public function toSmsFactory(object $notifiable): ?SmsFactoryMessage
    {
        $settings = SmsSettings::load();
        $recipient = $this->resolveSmsPhone($notifiable, $settings);

        if ($recipient === null) {
            return null;
        }

        $template = $this->resolveTemplate($settings);
        $content = trim((string) ($template['content'] ?? ''));

        if ($content === '') {
            $content = 'Vous avez un nouveau message concernant votre demande sur [MagicLink] [signature]';
        }

        $content = (new SmsComposer($settings))->compose($content, [
            'magic_link' => $this->magicLinkUrl,
        ]);

        return new SmsFactoryMessage($content, $recipient);
    }

    private function resolveTemplate(array $settings): array
    {
        $requestTemplate = $this->smsContext['template'] ?? null;

        if (is_array($requestTemplate) && ! empty($requestTemplate['content'] ?? null)) {
            return [
                'id' => (string) ($requestTemplate['id'] ?? ''),
                'title' => (string) ($requestTemplate['title'] ?? ''),
                'content' => (string) $requestTemplate['content'],
            ];
        }

        $templates = is_array($settings['templates'] ?? null) ? $settings['templates'] : [];

        foreach ($templates as $template) {
            if (! is_array($template)) {
                continue;
            }

            $id = (string) ($template['id'] ?? $template['title'] ?? '');
            if ($id === '') {
                continue;
            }

            if (($template['selected'] ?? false) || ($template['default'] ?? false)) {
                return [
                    'id' => $id,
                    'title' => (string) ($template['title'] ?? ''),
                    'content' => (string) ($template['content'] ?? ''),
                ];
            }
        }

        return ['id' => '', 'title' => '', 'content' => ''];
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

    private function resolveSmsPhone(object $notifiable, array $settings): ?string
    {
        $candidate = trim((string) ($this->ticket->contact_phone ?: ($notifiable->phone ?? '')));

        if ($candidate === '') {
            return null;
        }

        return PhoneNumber::normalize($candidate, (string) ($settings['default_country_code'] ?? '+33'));
    }

    private function resolveEmailAddress(object $notifiable): ?string
    {
        $routedMail = null;

        if (method_exists($notifiable, 'routeNotificationFor')) {
            $route = $notifiable->routeNotificationFor('mail', $this);

            if (is_string($route)) {
                $routedMail = $route;
            }
        }

        $candidate = trim((string) ($this->ticket->contact_email ?: ($routedMail ?: ($notifiable->email ?? ''))));

        return $candidate !== '' ? $candidate : null;
    }

    private function getTicketKindLabel(): string
    {
        return match ($this->ticket->ticket_kind) {
            'bug' => 'Bug',
            'improvement' => 'Amelioration',
            default => 'Support',
        };
    }
}
