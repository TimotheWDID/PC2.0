<?php

namespace App\Notifications\Channels;

use App\Notifications\Messages\SmsFactoryMessage;
use App\Support\SmsFactoryClient;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

class SmsFactoryChannel
{
    public function __construct(private SmsFactoryClient $client)
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

        if (is_array($message)) {
            $message = new SmsFactoryMessage(
                (string) ($message['content'] ?? ''),
                isset($message['recipient']) ? (string) $message['recipient'] : null,
                isset($message['sender']) ? (string) $message['sender'] : null,
            );
        }

        if (! $message instanceof SmsFactoryMessage) {
            throw new InvalidArgumentException('toSmsFactory must return SmsFactoryMessage, array or null.');
        }

        $recipient = $message->recipient;

        if (empty($recipient) && method_exists($notifiable, 'routeNotificationForSmsfactory')) {
            $recipient = $notifiable->routeNotificationForSmsfactory($notification);
        }

        if (empty($recipient)) {
            Log::warning('SMSFactory recipient is missing for notification.', [
                'notification' => $notification::class,
                'notifiable' => $notifiable::class,
            ]);

            return;
        }

        $this->client->send((string) $recipient, $message->content, $message->sender);
    }
}
