<?php

namespace App\Notifications\Channels;

use App\Notifications\Messages\SmsFactoryMessage;
use App\Support\Sms\PhoneNumber;
use App\Support\Sms\SmsFactorClient;
use Illuminate\Notifications\Notification;
use InvalidArgumentException;
use RuntimeException;

class SmsFactoryChannel
{
    public function __construct(private SmsFactorClient $client)
    {
    }

    public function send(object $notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toSmsFactory')) {
            return;
        }

        $message = $notification->toSmsFactory($notifiable);

        if ($message === null) {
            return;
        }

        if (! $message instanceof SmsFactoryMessage) {
            throw new InvalidArgumentException('toSmsFactory must return SmsFactoryMessage or null.');
        }

        $recipient = $message->recipient;

        if (empty($recipient) && method_exists($notifiable, 'routeNotificationFor')) {
            $route = $notifiable->routeNotificationFor('smsfactory', $notification);
            $recipient = is_string($route) ? $route : null;
        }

        $normalized = PhoneNumber::normalize((string) $recipient);

        if ($normalized === null) {
            // L'exception déclenche NotificationFailed → notification_error renseignée
            // sur le message au lieu d'un statut « pending » fantôme.
            throw new RuntimeException('Numéro de téléphone invalide pour le SMS : ' . (string) $recipient);
        }

        $result = $this->client->send($normalized, $message->content, $message->sender);

        if (! (bool) ($result['ok'] ?? false)) {
            $status = $result['http_status'] ?? null;
            $body = is_string($result['body'] ?? null) ? trim((string) $result['body']) : '';
            $errorMessage = 'Echec envoi SMSFactor';

            if ($status !== null) {
                $errorMessage .= ' (HTTP ' . (string) $status . ')';
            }

            if ($body !== '') {
                $errorMessage .= ': ' . mb_substr($body, 0, 250);
            }

            throw new RuntimeException($errorMessage);
        }
    }
}
