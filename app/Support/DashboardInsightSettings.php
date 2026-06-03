<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class DashboardInsightSettings
{
    public static function defaults(): array
    {
        return [
            'ticket_pending_hours' => (int) config('dashboard.insights.ticket_pending_hours', 48),
            'ticket_low_info_hours' => (int) config('dashboard.insights.ticket_low_info_hours', 24),
            'ticket_stalled_days' => (int) config('dashboard.insights.ticket_stalled_days', 5),
            'commande_incomplete_hours' => (int) config('dashboard.insights.commande_incomplete_hours', 24),
            'commande_stalled_days' => (int) config('dashboard.insights.commande_stalled_days', 3),
            'max_items_per_rule' => (int) config('dashboard.insights.max_items_per_rule', 3),
            'recent_tickets_limit' => (int) config('dashboard.insights.recent_tickets_limit', 6),
        ];
    }

    public static function load(): array
    {
        $defaults = self::defaults();
        $stored = [];

        if (Storage::disk('local')->exists('dashboard_insights.json')) {
            $raw = Storage::disk('local')->get('dashboard_insights.json');
            $decoded = json_decode($raw, true);

            if (is_array($decoded)) {
                $stored = $decoded;
            }
        }

        return array_merge($defaults, $stored);
    }

    public static function save(array $settings): void
    {
        Storage::disk('local')->put(
            'dashboard_insights.json',
            json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }
}
