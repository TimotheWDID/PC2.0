<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\Commande;
use App\Models\Ticket;
use App\Models\TicketTimelineEvent;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AdminDashboardController extends Controller
{
    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function formatDelayLabel(?\DateTimeInterface $dateTime): string
    {
        if (! $dateTime) {
            return 'date inconnue';
        }

        $now     = now();
        $minutes = (int) floor($now->diffInMinutes($dateTime, true));

        if ($minutes < 60) {
            return $minutes <= 1 ? '1 min' : "{$minutes} min";
        }

        $hours = (int) floor($now->diffInHours($dateTime, true));

        if ($hours < 24) {
            return $hours === 1 ? 'plus d\'1h' : "plus de {$hours}h";
        }

        $days = (int) floor($now->diffInDays($dateTime, true));

        if ($days < 7) {
            return $days === 1 ? 'plus d\'1 jour' : "plus de {$days} jours";
        }

        $weeks = max(1, intdiv($days, 7));

        if ($days < 30) {
            return $weeks <= 1 ? 'plus d\'1 semaine' : "plus de {$weeks} semaines";
        }

        $months = (int) floor($now->diffInMonths($dateTime, true));

        return $months <= 1 ? 'plus d\'1 mois' : "plus de {$months} mois";
    }

    private function formatUserName(?User $user): ?string
    {
        if (! $user) {
            return null;
        }

        return trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? '')) ?: null;
    }

    private function applyDateRange(Builder $query, ?Carbon $startDate, ?Carbon $endDate, string $column = 'created_at'): Builder
    {
        if ($startDate) {
            $query->where($column, '>=', $startDate);
        }

        if ($endDate) {
            $query->where($column, '<=', $endDate);
        }

        return $query;
    }

    private function applyAgentFilter(Builder $query, ?int $agentUserId, string $column = 'assignee_id'): Builder
    {
        if ($agentUserId) {
            $query->where($column, $agentUserId);
        }

        return $query;
    }

    private function applyCommandeAgentFilter(Builder $query, ?int $agentUserId): Builder
    {
        if ($agentUserId) {
            $query->whereHas('ticket', fn (Builder $ticketQuery) => $ticketQuery->where('assignee_id', $agentUserId));
        }

        return $query;
    }

    private function formatFilterLabel(?Carbon $startDate, ?Carbon $endDate, ?string $agentName = null): ?string
    {
        $parts = [];

        $format = static fn (Carbon $date) => $date->copy()->locale('fr')->isoFormat('DD/MM/YYYY');

        if ($startDate && $endDate && $startDate->isSameDay($endDate)) {
            $parts[] = 'le ' . $format($startDate);
        } elseif ($startDate && $endDate) {
            $parts[] = 'du ' . $format($startDate) . ' au ' . $format($endDate);
        } elseif ($startDate) {
            $parts[] = 'depuis le ' . $format($startDate);
        } elseif ($endDate) {
            $parts[] = 'jusqu\'au ' . $format($endDate);
        }

        if ($agentName) {
            $parts[] = 'agent ' . $agentName;
        }

        if ($parts === []) {
            return null;
        }

        return implode(' · ', $parts);
    }

    // ─── Main action ──────────────────────────────────────────────────────────

    public function index(Request $request)
    {
        $validated = $request->validate([
            'date' => ['nullable', 'date'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'agent_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $singleDate = $validated['date'] ?? null;
        $startDate = isset($validated['start_date'])
            ? Carbon::parse($validated['start_date'])->startOfDay()
            : ($singleDate ? Carbon::parse($singleDate)->startOfDay() : null);
        $endDate = isset($validated['end_date'])
            ? Carbon::parse($validated['end_date'])->endOfDay()
            : ($singleDate ? Carbon::parse($singleDate)->endOfDay() : null);
        $agentUserId = isset($validated['agent_id']) ? (int) $validated['agent_id'] : null;

        $ticketBaseQuery = $this->applyAgentFilter(
            $this->applyDateRange(Ticket::query()->standardOnly(), $startDate, $endDate),
            $agentUserId
        );

        // ── 1. Global ticket counters ─────────────────────────────────────────
        $globalStats = [
            'total'        => (clone $ticketBaseQuery)->where('status', '!=', 'closed')->count(),
            'open'         => (clone $ticketBaseQuery)->where('status', 'open')->count(),
            'in_progress'  => (clone $ticketBaseQuery)->where('status', 'in_progress')->count(),
            'pending'      => (clone $ticketBaseQuery)->where('status', 'pending')->count(),
            'resolved'     => (clone $ticketBaseQuery)->where('status', 'resolved')->count(),
            'closed'       => (clone $ticketBaseQuery)->where('status', 'closed')->count(),
            'unassigned'   => (clone $ticketBaseQuery)->whereNull('assignee_id')
                                    ->whereNotIn('status', ['resolved', 'closed'])
                                    ->count(),
            'high_priority'=> (clone $ticketBaseQuery)->where('priority', 'high')
                                    ->whereNotIn('status', ['resolved', 'closed'])
                                    ->count(),
            'today'        => (clone $ticketBaseQuery)->whereDate('created_at', today())->count(),
            'this_week'    => (clone $ticketBaseQuery)->where('created_at', '>=', now()->startOfWeek())->count(),
            'this_month'   => (clone $ticketBaseQuery)->where('created_at', '>=', now()->startOfMonth())->count(),
        ];

        // ── 2. Per-agent stats ────────────────────────────────────────────────
        $agents = Agent::with(['user', 'specialities'])->get();
        $agentOptions = $agents
            ->map(function (Agent $agent) {
                return [
                    'id' => $agent->user_id,
                    'name' => $this->formatUserName($agent->user) ?? $agent->user?->email ?? ('Agent #' . $agent->id),
                ];
            })
            ->filter(fn (array $agent) => $agent['id'])
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->toArray();
        $selectedAgentName = collect($agentOptions)->firstWhere('id', $agentUserId)['name'] ?? null;

        $hasDateFilter = (bool) ($startDate || $endDate);

        $agentStats = $agents->map(function (Agent $agent) use ($startDate, $endDate, $hasDateFilter) {
            $userId = $agent->user_id;
            $base   = $this->applyDateRange(Ticket::query()->standardOnly(), $startDate, $endDate)
                ->where('assignee_id', $userId);

            $assignedTotal   = (clone $base)->count();
            $assignedOpen    = (clone $base)->where('status', 'open')->count();
            $assignedPending = (clone $base)->where('status', 'pending')->count();
            $assignedInProg  = (clone $base)->where('status', 'in_progress')->count();
            $resolvedMonthQuery = Ticket::query()
                ->standardOnly()
                ->where('assignee_id', $userId)
                ->whereIn('status', ['resolved', 'closed']);

            if ($hasDateFilter) {
                $resolvedMonthQuery = $this->applyDateRange($resolvedMonthQuery, $startDate, $endDate, 'updated_at');
            } else {
                $resolvedMonthQuery->where('updated_at', '>=', now()->startOfMonth());
            }

            $resolvedMonth = $resolvedMonthQuery->count();
            $resolvedTotal   = (clone $base)->whereIn('status', ['resolved', 'closed'])->count();

            // High-priority active tickets
            $highPriority = (clone $base)
                ->where('priority', 'high')
                ->whereNotIn('status', ['resolved', 'closed'])
                ->count();

            // Last ticket activity (most recent updated_at among assigned tickets)
            $lastTicket = (clone $base)
                ->orderByDesc('updated_at')
                ->select('updated_at')
                ->first();

            // Stalled tickets: assigned to this agent, open/in_progress, not updated in 3+ days
            $stalledCount = (clone $base)
                ->whereIn('status', ['open', 'in_progress'])
                ->where('updated_at', '<=', now()->subDays(3))
                ->count();

            // Pending too long: pending > 24h
            $pendingTooLong = (clone $base)
                ->where('status', 'pending')
                ->where('updated_at', '<=', now()->subHours(24))
                ->count();

            $alertCount = $stalledCount + $pendingTooLong;

            return [
                'id'               => $agent->id,
                'user_id'          => $userId,
                'name'             => $this->formatUserName($agent->user),
                'email'            => $agent->user?->email,
                'is_admin'         => (bool) $agent->is_admin,
                'specialities'     => $agent->specialities->pluck('name')->values()->toArray(),
                'assigned_total'   => $assignedTotal,
                'assigned_open'    => $assignedOpen,
                'assigned_pending' => $assignedPending,
                'assigned_in_prog' => $assignedInProg,
                'resolved_month'   => $resolvedMonth,
                'resolved_total'   => $resolvedTotal,
                'high_priority'    => $highPriority,
                'stalled_count'    => $stalledCount,
                'pending_too_long' => $pendingTooLong,
                'alert_count'      => $alertCount,
                'last_activity'    => $lastTicket?->updated_at?->toIso8601String(),
                'last_activity_label' => $lastTicket
                    ? 'il y a ' . $this->formatDelayLabel($lastTicket->updated_at)
                    : 'Aucune activité',
            ];
        })->values()->toArray();

        if ($agentUserId) {
            $agentStats = array_values(array_filter(
                $agentStats,
                fn (array $agent) => (int) $agent['user_id'] === $agentUserId
            ));
        }

        // ── 3. Alerts: unassigned tickets (open/in_progress) ─────────────────
        $unassignedTickets = $this->applyAgentFilter(
            $this->applyDateRange(Ticket::query()->standardOnly(), $startDate, $endDate),
            $agentUserId
        )
            ->whereNull('assignee_id')
            ->whereNotIn('status', ['resolved', 'closed'])
            ->with(['user:id,first_name,last_name', 'category:id,name'])
            ->orderByRaw("FIELD(priority, 'high', 'medium', 'low')")
            ->orderBy('updated_at')
            ->limit(20)
            ->get()
            ->map(function (Ticket $ticket) {
                return [
                    'id'             => $ticket->id,
                    'title'          => $ticket->title,
                    'status'         => $ticket->status,
                    'priority'       => $ticket->priority,
                    'category'       => $ticket->category?->name,
                    'requester_name' => $this->formatUserName($ticket->user),
                    'created_at'     => $ticket->created_at?->toIso8601String(),
                    'updated_at'     => $ticket->updated_at?->toIso8601String(),
                    'age_label'      => 'Depuis ' . $this->formatDelayLabel($ticket->created_at),
                ];
            });

        // ── 4. Alerts: stalled tickets (open/in_progress, not updated 3+ days) ──
        $stalledTickets = $this->applyAgentFilter(
            $this->applyDateRange(Ticket::query()->standardOnly(), $startDate, $endDate),
            $agentUserId
        )
            ->whereIn('status', ['open', 'in_progress'])
            ->where('updated_at', '<=', now()->subDays(3))
            ->with([
                'user:id,first_name,last_name',
                'assignee:id,first_name,last_name',
                'category:id,name',
            ])
            ->orderBy('updated_at')
            ->limit(20)
            ->get()
            ->map(function (Ticket $ticket) {
                return [
                    'id'             => $ticket->id,
                    'title'          => $ticket->title,
                    'status'         => $ticket->status,
                    'priority'       => $ticket->priority,
                    'category'       => $ticket->category?->name,
                    'requester_name' => $this->formatUserName($ticket->user),
                    'assignee_name'  => $this->formatUserName($ticket->assignee),
                    'updated_at'     => $ticket->updated_at?->toIso8601String(),
                    'stalled_since'  => 'Depuis ' . $this->formatDelayLabel($ticket->updated_at),
                ];
            });

        // ── 5. Alerts: pending tickets too long (>24h) ─────────────────────
        $pendingTooLongTickets = $this->applyAgentFilter(
            $this->applyDateRange(Ticket::query()->standardOnly(), $startDate, $endDate),
            $agentUserId
        )
            ->where('status', 'pending')
            ->where('updated_at', '<=', now()->subHours(24))
            ->with([
                'user:id,first_name,last_name',
                'assignee:id,first_name,last_name',
                'category:id,name',
            ])
            ->orderBy('updated_at')
            ->limit(20)
            ->get()
            ->map(function (Ticket $ticket) {
                return [
                    'id'             => $ticket->id,
                    'title'          => $ticket->title,
                    'status'         => $ticket->status,
                    'priority'       => $ticket->priority,
                    'category'       => $ticket->category?->name,
                    'requester_name' => $this->formatUserName($ticket->user),
                    'assignee_name'  => $this->formatUserName($ticket->assignee),
                    'updated_at'     => $ticket->updated_at?->toIso8601String(),
                    'pending_since'  => 'En attente depuis ' . $this->formatDelayLabel($ticket->updated_at),
                ];
            });

        // ── 6. Recent tickets ─────────────────────────────────────────────────
        $recentTickets = $this->applyAgentFilter(
            $this->applyDateRange(Ticket::query()->standardOnly(), $startDate, $endDate),
            $agentUserId
        )
            ->with([
            'user:id,first_name,last_name',
            'assignee:id,first_name,last_name',
            'category:id,name',
        ])
            ->withCount('messages')
            ->orderByDesc('updated_at')
            ->limit(15)
            ->get()
            ->map(function (Ticket $ticket) {
                return [
                    'id'             => $ticket->id,
                    'title'          => $ticket->title,
                    'status'         => $ticket->status,
                    'priority'       => $ticket->priority,
                    'category'       => $ticket->category?->name,
                    'requester_name' => $this->formatUserName($ticket->user),
                    'assignee_name'  => $this->formatUserName($ticket->assignee),
                    'messages_count' => $ticket->messages_count ?? 0,
                    'updated_at'     => $ticket->updated_at?->toIso8601String(),
                    'created_at'     => $ticket->created_at?->toIso8601String(),
                ];
            });

        // ── 7. Tickets by day — snapshot per status via history + created count ──────
        $chartStartDate = $startDate
            ? $startDate->copy()
            : ($endDate ? $endDate->copy()->subDays(13)->startOfDay() : now()->subDays(13)->startOfDay());
        $chartEndDate = $endDate
            ? $endDate->copy()
            : ($startDate ? min($startDate->copy()->addDays(13)->endOfDay(), now()->endOfDay()) : now()->endOfDay());

        if ($chartStartDate->greaterThan($chartEndDate)) {
            [$chartStartDate, $chartEndDate] = [$chartEndDate->copy()->startOfDay(), $chartStartDate->copy()->endOfDay()];
        }

        // All tickets that existed at any point on or before the end of the window
        $allTickets = $this->applyAgentFilter(Ticket::query()->standardOnly(), $agentUserId)
            ->where('created_at', '<=', $chartEndDate)
            ->select('id', 'created_at', 'status')
            ->get();

        $ticketIds = $allTickets->pluck('id')->all();

        // Status-changed events for those tickets, sorted ASC by happened_at
        $statusEventsGrouped = TicketTimelineEvent::whereIn('ticket_id', $ticketIds)
            ->where('event_type', 'status_changed')
            ->orderBy('ticket_id')
            ->orderBy('happened_at')
            ->select('ticket_id', 'happened_at', 'details')
            ->get()
            ->groupBy('ticket_id');

        // Build per-ticket history (sorted ASC already)
        $ticketHistories = [];
        foreach ($allTickets as $ticket) {
            $events = $statusEventsGrouped->get($ticket->id, collect());
            $history = [];
            foreach ($events as $event) {
                $details = is_array($event->details) ? $event->details : [];
                if (isset($details['after'])) {
                    $history[] = ['at' => $event->happened_at, 'after' => $details['after']];
                }
            }
            $firstEvent    = $events->first();
            $initialStatus = $firstEvent
                ? ((is_array($firstEvent->details) ? ($firstEvent->details['before'] ?? null) : null) ?? 'open')
                : $ticket->status;

            $ticketHistories[] = [
                'created_at'     => $ticket->created_at,
                'initial_status' => $initialStatus,
                'history'        => $history,
            ];
        }

        // Tickets created per day (with full filters for consistency)
        $createdByDay = $this->applyAgentFilter(Ticket::query()->standardOnly(), $agentUserId)
            ->select(DB::raw('DATE(created_at) as day'), DB::raw('COUNT(*) as count'))
            ->whereBetween('created_at', [$chartStartDate, $chartEndDate])
            ->groupBy('day')
            ->get()
            ->keyBy('day')
            ->map(fn ($r) => (int) $r->count);

        // Build per-day snapshots by walking each ticket's status history
        $statusKeys = ['open', 'in_progress', 'pending', 'resolved', 'closed'];
        $ticketsByDayFormatted = [];
        $cursor       = $chartStartDate->copy()->startOfDay();
        $chartLastDay = $chartEndDate->copy()->startOfDay();
        while ($cursor->lte($chartLastDay)) {
            $dayEnd = $cursor->copy()->endOfDay();
            $date   = $cursor->format('Y-m-d');
            $counts = array_fill_keys($statusKeys, 0);

            foreach ($ticketHistories as $ticketData) {
                if ($ticketData['created_at']->gt($dayEnd)) {
                    continue; // ticket did not exist yet on this day
                }
                $statusAtDay = $ticketData['initial_status'];
                foreach ($ticketData['history'] as $event) {
                    if ($event['at']->lte($dayEnd)) {
                        $statusAtDay = $event['after'];
                    } else {
                        break; // history sorted ASC, no need to continue
                    }
                }
                if (isset($counts[$statusAtDay])) {
                    $counts[$statusAtDay]++;
                }
            }

            $ticketsByDayFormatted[] = [
                'date'        => $date,
                'label'       => $cursor->copy()->locale('fr')->isoFormat('DD MMM'),
                'open'        => $counts['open'],
                'in_progress' => $counts['in_progress'],
                'pending'     => $counts['pending'],
                'resolved'    => $counts['resolved'],
                'closed'      => $counts['closed'],
                'created'     => $createdByDay[$date] ?? 0,
            ];
            $cursor->addDay();
        }

        // ── 8. Commandes overview ─────────────────────────────────────────────
        $commandeBaseQuery = $this->applyCommandeAgentFilter(
            $this->applyDateRange(Commande::query(), $startDate, $endDate),
            $agentUserId
        );

        $commandeStats = [
            'total'   => (clone $commandeBaseQuery)->count(),
            'new'     => (clone $commandeBaseQuery)->where('statut', 'new')->count(),
            'panier'  => (clone $commandeBaseQuery)->where('statut', 'panier')->count(),
            'ordered' => (clone $commandeBaseQuery)->where('statut', 'ordered')->count(),
            'received'=> (clone $commandeBaseQuery)->where('statut', 'received')->count(),
        ];

        // Commandes stalled (new or panier, not updated in 2+ days)
        $stalledCommandes = $this->applyCommandeAgentFilter(
            $this->applyDateRange(Commande::query(), $startDate, $endDate),
            $agentUserId
        )
            ->whereIn('statut', ['new', 'panier'])
            ->where('updated_at', '<=', now()->subDays(2))
            ->with(['ticket:id,title,status'])
            ->orderBy('updated_at')
            ->limit(10)
            ->get()
            ->map(function (Commande $commande) {
                return [
                    'id'           => $commande->id,
                    'nom'          => $commande->nom,
                    'statut'       => $commande->statut,
                    'fournisseur'  => $commande->fournisseur,
                    'ticket_id'    => $commande->ticket_id,
                    'ticket_title' => $commande->ticket?->title,
                    'updated_at'   => $commande->updated_at?->toIso8601String(),
                    'stalled_since'=> 'Depuis ' . $this->formatDelayLabel($commande->updated_at),
                ];
            });

        // ── 9. Summary alert count ────────────────────────────────────────────
        $totalAlerts = $unassignedTickets->count()
            + $stalledTickets->count()
            + $pendingTooLongTickets->count()
            + $stalledCommandes->count();

        return Inertia::render('Admin/Dashboard', [
            'globalStats'           => $globalStats,
            'agentStats'            => $agentStats,
            'unassignedTickets'     => $unassignedTickets,
            'stalledTickets'        => $stalledTickets,
            'pendingTooLongTickets' => $pendingTooLongTickets,
            'recentTickets'         => $recentTickets,
            'ticketsByDay'          => $ticketsByDayFormatted,
            'commandeStats'         => $commandeStats,
            'stalledCommandes'      => $stalledCommandes,
            'totalAlerts'           => $totalAlerts,
            'agentOptions'          => $agentOptions,
            'filters'               => [
                'date' => $singleDate,
                'start_date' => $validated['start_date'] ?? null,
                'end_date' => $validated['end_date'] ?? null,
                'agent_id' => $agentUserId,
                'has_filter' => (bool) ($singleDate || isset($validated['start_date']) || isset($validated['end_date']) || $agentUserId),
                'label' => $this->formatFilterLabel($startDate, $endDate, $selectedAgentName),
            ],
        ]);
    }
}
