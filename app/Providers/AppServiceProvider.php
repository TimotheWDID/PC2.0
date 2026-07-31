<?php

namespace App\Providers;

use App\Models\Message;
use App\Notifications\Channels\SmsFactoryChannel;
use App\Notifications\TicketMessageNotification;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Notifications\Events\NotificationFailed;
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Throwable;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('ticket-magic-link', function (Request $request) {
            $ipKey = 'ip:' . $request->ip() . '|path:' . $request->path();
            $minuteLimit = max(1, (int) config('ticket_magic_link.rate_limit_per_minute', 10));
            $hourLimit = max(1, (int) config('ticket_magic_link.rate_limit_per_hour', 60));

            return [
                Limit::perMinute($minuteLimit)->by($ipKey),
                Limit::perHour($hourLimit)->by($ipKey),
            ];
        });

        RateLimiter::for('ticket-messages', function (Request $request) {
            $user = $request->user();

            if ($user) {
                $ticketId = (string) $request->route('ticket');
                $key = 'user:' . $user->id . '|ticket:' . $ticketId;
                $minuteLimit = max(1, (int) config('ticket_magic_link.messages_auth_per_minute', 240));
                $hourLimit = max(1, (int) config('ticket_magic_link.messages_auth_per_hour', 2000));

                return [
                    Limit::perMinute($minuteLimit)->by($key),
                    Limit::perHour($hourLimit)->by($key),
                ];
            }

            $ip = (string) $request->ip();
            $ticketId = (string) $request->route('ticket');
            $token = trim((string) $request->query('token', ''));
            $usesToken = $token !== '';

            $tokenFingerprint = $usesToken
                ? hash('sha256', $token)
                : 'none';

            $key = $usesToken
                ? 'token:' . $tokenFingerprint . '|ticket:' . $ticketId
                : 'ip:' . $ip . '|ticket:' . $ticketId;

            $minuteLimit = $usesToken
                ? max(1, (int) config('ticket_magic_link.messages_token_per_minute', 40))
                : max(1, (int) config('ticket_magic_link.messages_anonymous_per_minute', 10));

            $hourLimit = $usesToken
                ? max(1, (int) config('ticket_magic_link.messages_token_per_hour', 600))
                : max(1, (int) config('ticket_magic_link.messages_anonymous_per_hour', 120));

            return [
                Limit::perMinute($minuteLimit)->by($key),
                Limit::perHour($hourLimit)->by($key),
            ];
        });

        Event::listen(NotificationSent::class, function (NotificationSent $event): void {
            if (! $event->notification instanceof TicketMessageNotification) {
                return;
            }

            $messageId = (int) ($event->notification->message->id ?? 0);
            if ($messageId <= 0) {
                return;
            }

            $resolvedChannel = $this->resolveDeliveryChannelFromNotificationChannel($event->channel)
                ?? (is_string($event->notification->ticket->notify_by ?? null) ? $event->notification->ticket->notify_by : null);

            Message::query()
                ->whereKey($messageId)
                ->update([
                    'notification_channel' => $resolvedChannel,
                    'notification_status' => 'sent',
                    'notification_error' => null,
                    'notified_at' => now(),
                ]);
        });

        Event::listen(NotificationFailed::class, function (NotificationFailed $event): void {
            if (! $event->notification instanceof TicketMessageNotification) {
                return;
            }

            $messageId = (int) ($event->notification->message->id ?? 0);
            if ($messageId <= 0) {
                return;
            }

            $resolvedChannel = $this->resolveDeliveryChannelFromNotificationChannel($event->channel)
                ?? (is_string($event->notification->ticket->notify_by ?? null) ? $event->notification->ticket->notify_by : null);

            $error = null;
            $exception = $event->data['exception'] ?? null;

            if ($exception instanceof Throwable) {
                $error = trim($exception->getMessage());
            } elseif (is_string($exception)) {
                $error = trim($exception);
            }

            if ($error === '') {
                $error = 'Erreur pendant l\'envoi de la notification.';
            }

            Message::query()
                ->whereKey($messageId)
                ->update([
                    'notification_channel' => $resolvedChannel,
                    'notification_status' => 'failed',
                    'notification_error' => $error,
                    'notified_at' => null,
                ]);
        });

        if (app()->isProduction() && str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }
    }

    private function resolveDeliveryChannelFromNotificationChannel(string $channel): ?string
    {
        if ($channel === 'mail') {
            return 'Email';
        }

        if ($channel === SmsFactoryChannel::class) {
            return 'SMS';
        }

        return null;
    }
}
