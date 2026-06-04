<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class DashboardInsightSettings
{
    public static function defaults(): array
    {
        $ticketPendingHours = (int) config('dashboard.insights.ticket_pending_hours', 48);
        $ticketLowInfoHours = (int) config('dashboard.insights.ticket_low_info_hours', 24);
        $ticketStalledDays = (int) config('dashboard.insights.ticket_stalled_days', 5);

        return [
            'ticket_pending_hours' => $ticketPendingHours,
            'ticket_pending_hours_by_priority' => [
                'high' => $ticketPendingHours,
                'medium' => $ticketPendingHours,
                'low' => $ticketPendingHours,
            ],
            'ticket_low_info_hours' => $ticketLowInfoHours,
            'ticket_low_info_hours_by_priority' => [
                'high' => $ticketLowInfoHours,
                'medium' => $ticketLowInfoHours,
                'low' => $ticketLowInfoHours,
            ],
            'ticket_stalled_days' => $ticketStalledDays,
            'ticket_stalled_days_by_priority' => [
                'high' => $ticketStalledDays,
                'medium' => $ticketStalledDays,
                'low' => $ticketStalledDays,
            ],
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

        return array_replace_recursive($defaults, $stored);
    }

    public static function save(array $settings): void
    {
        Storage::disk('local')->put(
            'dashboard_insights.json',
            json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }
}
