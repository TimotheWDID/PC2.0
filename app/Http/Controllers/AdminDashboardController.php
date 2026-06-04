<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\Commande;
use App\Models\Ticket;
use App\Models\User;
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

    // ─── Main action ──────────────────────────────────────────────────────────

    public function index()
    {
        // ── 1. Global ticket counters ─────────────────────────────────────────
        $globalStats = [
            'total'        => Ticket::count(),
            'open'         => Ticket::where('status', 'open')->count(),
            'in_progress'  => Ticket::where('status', 'in_progress')->count(),
            'pending'      => Ticket::where('status', 'pending')->count(),
            'resolved'     => Ticket::where('status', 'resolved')->count(),
            'closed'       => Ticket::where('status', 'closed')->count(),
            'unassigned'   => Ticket::whereNull('assignee_id')
                                    ->whereNotIn('status', ['resolved', 'closed'])
                                    ->count(),
            'high_priority'=> Ticket::where('priority', 'high')
                                    ->whereNotIn('status', ['resolved', 'closed'])
                                    ->count(),
            'today'        => Ticket::whereDate('created_at', today())->count(),
            'this_week'    => Ticket::where('created_at', '>=', now()->startOfWeek())->count(),
            'this_month'   => Ticket::where('created_at', '>=', now()->startOfMonth())->count(),
        ];

        // ── 2. Per-agent stats ────────────────────────────────────────────────
        $agents = Agent::with(['user', 'specialities'])->get();

        $agentStats = $agents->map(function (Agent $agent) {
            $userId = $agent->user_id;
            $base   = Ticket::where('assignee_id', $userId);

            $assignedTotal   = (clone $base)->count();
            $assignedOpen    = (clone $base)->where('status', 'open')->count();
            $assignedPending = (clone $base)->where('status', 'pending')->count();
            $assignedInProg  = (clone $base)->where('status', 'in_progress')->count();
            $resolvedMonth   = (clone $base)
                                ->whereIn('status', ['resolved', 'closed'])
                                ->where('updated_at', '>=', now()->startOfMonth())
                                ->count();
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
                'last_activity'    => $lastTicket?->updated_at?->toDateTimeString(),
                'last_activity_label' => $lastTicket
                    ? 'il y a ' . $this->formatDelayLabel($lastTicket->updated_at)
                    : 'Aucune activité',
            ];
        })->values()->toArray();

        // ── 3. Alerts: unassigned tickets (open/in_progress) ─────────────────
        $unassignedTickets = Ticket::whereNull('assignee_id')
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
                    'created_at'     => $ticket->created_at?->toDateTimeString(),
                    'updated_at'     => $ticket->updated_at?->toDateTimeString(),
                    'age_label'      => 'Depuis ' . $this->formatDelayLabel($ticket->created_at),
                ];
            });

        // ── 4. Alerts: stalled tickets (open/in_progress, not updated 3+ days) ──
        $stalledTickets = Ticket::whereIn('status', ['open', 'in_progress'])
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
                    'updated_at'     => $ticket->updated_at?->toDateTimeString(),
                    'stalled_since'  => 'Depuis ' . $this->formatDelayLabel($ticket->updated_at),
                ];
            });

        // ── 5. Alerts: pending tickets too long (>24h) ─────────────────────
        $pendingTooLongTickets = Ticket::where('status', 'pending')
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
                    'updated_at'     => $ticket->updated_at?->toDateTimeString(),
                    'pending_since'  => 'En attente depuis ' . $this->formatDelayLabel($ticket->updated_at),
                ];
            });

        // ── 6. Recent tickets ─────────────────────────────────────────────────
        $recentTickets = Ticket::with([
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
                    'updated_at'     => $ticket->updated_at?->toDateTimeString(),
                    'created_at'     => $ticket->created_at?->toDateTimeString(),
                ];
            });

        // ── 7. Tickets by day (last 14 days) for chart ───────────────────────
        $ticketsByDay = Ticket::select(
                DB::raw('DATE(created_at) as day'),
                DB::raw('COUNT(*) as count')
            )
            ->where('created_at', '>=', now()->subDays(13)->startOfDay())
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->keyBy('day')
            ->map(fn ($row) => (int) $row->count);

        $ticketsByDayFormatted = [];
        for ($i = 13; $i >= 0; $i--) {
            $date = now()->subDays($i)->format('Y-m-d');
            $label = now()->subDays($i)->locale('fr')->isoFormat('DD MMM');
            $ticketsByDayFormatted[] = [
                'date'  => $date,
                'label' => $label,
                'count' => $ticketsByDay[$date] ?? 0,
            ];
        }

        // ── 8. Commandes overview ─────────────────────────────────────────────
        $commandeStats = [
            'total'   => Commande::count(),
            'new'     => Commande::where('statut', 'new')->count(),
            'panier'  => Commande::where('statut', 'panier')->count(),
            'ordered' => Commande::where('statut', 'ordered')->count(),
            'received'=> Commande::where('statut', 'received')->count(),
        ];

        // Commandes stalled (new or panier, not updated in 2+ days)
        $stalledCommandes = Commande::whereIn('statut', ['new', 'panier'])
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
                    'updated_at'   => $commande->updated_at?->toDateTimeString(),
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
        ]);
    }
}
