<?php

namespace App\Notifications;

use App\Models\Ticket;
use App\Notifications\Channels\SmsFactoryChannel;
use App\Notifications\Messages\SmsFactoryMessage;
use App\Support\MailFooterSettings;
use App\Support\Sms\PhoneNumber;
use App\Support\Sms\SmsComposer;
use App\Support\Sms\SmsSettings;
use App\Support\TicketCreatedNotificationSettings;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class TicketCreatedCustomerNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Ticket $ticket,
        public string $ticketLink
    ) {
    }

    public function via(object $notifiable): array
    {
        $settings = TicketCreatedNotificationSettings::load();

        if (! (bool) ($settings['enabled'] ?? false)) {
            return [];
        }

        $preference = $this->resolveNotificationPreference();

        if ($preference === 'SMS') {
            $smsSettings = SmsSettings::load();
            $phone = $this->resolveSmsPhone($smsSettings);

            return SmsSettings::isEnabled($smsSettings) && $phone !== null
                ? [SmsFactoryChannel::class]
                : [];
        }

        if ($preference === 'Email') {
            return $this->resolveEmailAddress() !== null ? ['mail'] : [];
        }

        return [];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $settings = TicketCreatedNotificationSettings::load();
        $context = $this->buildContext();

        return (new MailMessage)
            ->subject($this->renderTemplate((string) ($settings['mail_subject'] ?? ''), $context))
            ->markdown('emails.tickets.created', [
                'ticket' => $this->ticket,
                'mailBody' => $this->renderTemplate((string) ($settings['mail_body'] ?? ''), $context),
                'magicLinkUrl' => $this->ticketLink,
                'mailFooter' => MailFooterSettings::load(),
            ]);
    }

    public function toSmsFactory(object $notifiable): ?SmsFactoryMessage
    {
        $smsSettings = SmsSettings::load();
        $recipient = $this->resolveSmsPhone($smsSettings);

        if ($recipient === null) {
            return null;
        }

        $settings = TicketCreatedNotificationSettings::load();
        $content = $this->renderTemplate((string) ($settings['sms_body'] ?? ''), $this->buildContext());
        $content = (new SmsComposer($smsSettings))->compose($content, [
            'magic_link' => $this->ticketLink,
        ]);

        return new SmsFactoryMessage($content, $recipient);
    }

    private function resolveNotificationPreference(): string
    {
        $ticketPreference = trim((string) ($this->ticket->notify_by ?? ''));

        if (in_array($ticketPreference, ['SMS', 'Email', 'None'], true)) {
            return $ticketPreference;
        }

        $email = $this->resolveEmailAddress();
        if ($email !== null) {
            return 'Email';
        }

        $phone = $this->resolveSmsPhone(SmsSettings::load());
        if ($phone !== null) {
            return 'SMS';
        }

        return 'None';
    }

    private function resolveSmsPhone(array $smsSettings): ?string
    {
        $candidate = trim((string) ($this->ticket->contact_phone ?: ($this->ticket->user?->phone ?? '')));

        if ($candidate === '') {
            return null;
        }

        return PhoneNumber::normalize($candidate, (string) ($smsSettings['default_country_code'] ?? '+33'));
    }

    private function resolveEmailAddress(): ?string
    {
        $candidate = trim((string) ($this->ticket->contact_email ?: ($this->ticket->user?->email ?? '')));

        return $candidate !== '' ? $candidate : null;
    }

    private function buildContext(): array
    {
        $clientName = trim((string) ($this->ticket->user?->first_name ?? ''));
        if ($clientName === '') {
            $clientName = trim((string) ($this->ticket->user?->name ?? ''));
        }
        if ($clientName === '') {
            $clientName = 'client';
        }

        return [
            '{ticket_id}' => (string) $this->ticket->id,
            '{ticket_title}' => trim(Str::limit((string) ($this->ticket->title ?? ''), 120, '')),
            '{client_name}' => $clientName,
            '{ticket_link}' => $this->ticketLink,
            '{app_name}' => (string) config('app.name', 'SupportPC'),
        ];
    }

    private function renderTemplate(string $template, array $context): string
    {
        $rendered = strtr($template, $context);

        return trim($rendered);
    }
}
