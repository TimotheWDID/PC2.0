<?php

namespace App\Notifications;

use App\Models\RemoteSubscription;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class RemoteSubscriptionExpiringNotification extends Notification
{
    use Queueable;

    public function __construct(public RemoteSubscription $subscription) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $daysLeft = $this->subscription->daysLeft();
        $client = $this->subscription->user?->name ?: ($this->subscription->user?->email ?? 'Client');

        return [
            'type' => 'remote_subscription_expiring',
            'remote_subscription_id' => $this->subscription->id,
            'ticket_id' => null,
            'client_name' => $client,
            'plan' => $this->subscription->plan,
            'ends_on' => $this->subscription->ends_on?->toDateString(),
            'days_left' => $daysLeft,
            'reason' => $daysLeft !== null && $daysLeft <= 0
                ? "L'abonnement {$this->subscription->plan} de {$client} se termine aujourd'hui."
                : "L'abonnement {$this->subscription->plan} de {$client} se termine dans {$daysLeft} jour(s), le {$this->subscription->ends_on?->format('d/m/Y')}.",
            'href' => '/remote-subscriptions/'.$this->subscription->id,
        ];
    }
}
