<?php

namespace App\Console\Commands;

use App\Models\RemoteSubscription;
use App\Models\User;
use App\Notifications\RemoteSubscriptionExpiringNotification;
use Illuminate\Console\Command;

class NotifyExpiringRemoteSubscriptions extends Command
{
    protected $signature = 'supportpc:remote-subscriptions-expiring';

    protected $description = 'Notify agents about NinjaOne subscriptions ending within the alert window.';

    public function handle(): int
    {
        $subscriptions = RemoteSubscription::query()
            ->with('user:id,first_name,last_name,email')
            ->where('status', 'active')
            ->whereNull('expiry_notified_at')
            ->whereNotNull('ends_on')
            ->whereDate('ends_on', '>=', now()->toDateString())
            ->whereDate('ends_on', '<=', now()->addDays(RemoteSubscription::EXPIRY_ALERT_DAYS)->toDateString())
            ->get();

        if ($subscriptions->isEmpty()) {
            $this->info('No subscription to notify.');

            return self::SUCCESS;
        }

        $agents = User::query()
            ->whereHas('agent', fn ($query) => $query->where('is_active', true))
            ->get();

        foreach ($subscriptions as $subscription) {
            $agents->each(fn (User $agent) => $agent->notify(new RemoteSubscriptionExpiringNotification($subscription)));
            $subscription->forceFill(['expiry_notified_at' => now()])->saveQuietly();
        }

        $this->info($subscriptions->count().' subscription(s) notified.');

        return self::SUCCESS;
    }
}
