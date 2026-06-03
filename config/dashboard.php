<?php

return [
    'insights' => [
        // Ticket pending threshold before surfacing a critical reminder.
        'ticket_pending_hours' => env('DASHBOARD_TICKET_PENDING_HOURS', 48),

        // Ticket with very low activity threshold for "needs update" suggestions.
        'ticket_low_info_hours' => env('DASHBOARD_TICKET_LOW_INFO_HOURS', 24),

        // Active ticket threshold before suggesting requalification.
        'ticket_stalled_days' => env('DASHBOARD_TICKET_STALLED_DAYS', 5),

        // Incomplete commande threshold (missing fournisseur/numero).
        'commande_incomplete_hours' => env('DASHBOARD_COMMANDE_INCOMPLETE_HOURS', 24),

        // Commande waiting in early statuses for too long.
        'commande_stalled_days' => env('DASHBOARD_COMMANDE_STALLED_DAYS', 3),

        // Max suggestions per insight rule.
        'max_items_per_rule' => env('DASHBOARD_MAX_ITEMS_PER_RULE', 3),

        // Number of recent tickets displayed on dashboard.
        'recent_tickets_limit' => env('DASHBOARD_RECENT_TICKETS_LIMIT', 6),
    ],
];
