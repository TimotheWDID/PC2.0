<?php

namespace App\Http\Controllers;

use App\Models\Commande;
use App\Notifications\AgentMentionNotification;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Ticket;
use App\Support\DashboardInsightSettings;
use Illuminate\Support\Facades\Auth;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Str;
use Throwable;

class DashboardController extends Controller
{
    private function insightConfig(): array
    {
        return DashboardInsightSettings::load();
    }

    private function resolveTicketPriorityThresholds(array $insightConfig, string $baseKey): array
    {
        $fallback = max(1, (int) ($insightConfig[$baseKey] ?? 1));
        $prioritySettings = $insightConfig[$baseKey . '_by_priority'] ?? [];

        return [
            'high' => max(1, (int) ($prioritySettings['high'] ?? $fallback)),
            'medium' => max(1, (int) ($prioritySettings['medium'] ?? $fallback)),
            'low' => max(1, (int) ($prioritySettings['low'] ?? $fallback)),
        ];
    }

    private function applyPriorityHoursThreshold(Builder $query, array $thresholds): Builder
    {
        $knownPriorities = ['high', 'medium', 'low'];
        $fallbackHours = max(1, (int) ($thresholds['medium'] ?? 1));

        return $query->where(function (Builder $thresholdQuery) use ($thresholds, $knownPriorities, $fallbackHours) {
            foreach ($knownPriorities as $priority) {
                $hours = max(1, (int) ($thresholds[$priority] ?? $fallbackHours));

                $thresholdQuery->orWhere(function (Builder $priorityQuery) use ($priority, $hours) {
                    $priorityQuery
                        ->where('priority', $priority)
                        ->where('updated_at', '<=', now()->subHours($hours));
                });
            }

            $thresholdQuery->orWhere(function (Builder $fallbackQuery) use ($knownPriorities, $fallbackHours) {
                $fallbackQuery
                    ->where(function (Builder $unknownPriorityQuery) use ($knownPriorities) {
                        $unknownPriorityQuery
                            ->whereNull('priority')
                            ->orWhereNotIn('priority', $knownPriorities);
                    })
                    ->where('updated_at', '<=', now()->subHours($fallbackHours));
            });
        });
    }

    private function applyPriorityDaysThreshold(Builder $query, array $thresholds): Builder
    {
        $knownPriorities = ['high', 'medium', 'low'];
        $fallbackDays = max(1, (int) ($thresholds['medium'] ?? 1));

        return $query->where(function (Builder $thresholdQuery) use ($thresholds, $knownPriorities, $fallbackDays) {
            foreach ($knownPriorities as $priority) {
                $days = max(1, (int) ($thresholds[$priority] ?? $fallbackDays));

                $thresholdQuery->orWhere(function (Builder $priorityQuery) use ($priority, $days) {
                    $priorityQuery
                        ->where('priority', $priority)
                        ->where('updated_at', '<=', now()->subDays($days));
                });
            }

            $thresholdQuery->orWhere(function (Builder $fallbackQuery) use ($knownPriorities, $fallbackDays) {
                $fallbackQuery
                    ->where(function (Builder $unknownPriorityQuery) use ($knownPriorities) {
                        $unknownPriorityQuery
                            ->whereNull('priority')
                            ->orWhereNotIn('priority', $knownPriorities);
                    })
                    ->where('updated_at', '<=', now()->subDays($fallbackDays));
            });
        });
    }

    private function formatUserName(?\App\Models\User $user): ?string
    {
        if (! $user) {
            return null;
        }

        return trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? '')) ?: null;
    }

    private function serializeTicket(Ticket $ticket): array
    {
        return [
            'id' => $ticket->id,
            'title' => $ticket->title ?? null,
            'status' => $ticket->status ?? null,
            'priority' => $ticket->priority ?? null,
            'category' => $ticket->category?->name,
            'requester_name' => $this->formatUserName($ticket->user),
            'assignee_name' => $this->formatUserName($ticket->assignee),
            'messages_count' => $ticket->messages_count ?? 0,
            'is_locked' => (bool) $ticket->is_locked,
            'is_resolved' => (bool) $ticket->is_resolved,
            'created_at' => $ticket->created_at ? $ticket->created_at->toDateTimeString() : null,
            'updated_at' => $ticket->updated_at ? $ticket->updated_at->toDateTimeString() : null,
        ];
    }

    private function serializeCommande(Commande $commande): array
    {
        return [
            'id' => $commande->id,
            'nom' => $commande->nom ?? null,
            'fournisseur' => $commande->fournisseur ?? null,
            'command_number' => $commande->command_number ?? null,
            'statut' => $commande->statut ?? null,
            'ticket_id' => $commande->ticket_id,
            'ticket_title' => $commande->ticket?->title ?? null,
            'ticket_status' => $commande->ticket?->status ?? null,
            'updated_at' => $commande->updated_at ? $commande->updated_at->toDateTimeString() : null,
            'created_at' => $commande->created_at ? $commande->created_at->toDateTimeString() : null,
        ];
    }

    private function formatDelayLabel(?\DateTimeInterface $dateTime): string
    {
        if (! $dateTime) {
            return 'date inconnue';
        }

        $now = now();
        $minutes = (int) floor($now->diffInMinutes($dateTime, true));

        if ($minutes < 60) {
            if ($minutes <= 1) {
                return '1 minute';
            }

            return $minutes . ' minutes';
        }

        $hours = (int) floor($now->diffInHours($dateTime, true));

        if ($hours < 24) {
            if ($hours === 1) {
                return 'plus d\'une heure';
            }

            return 'plus de ' . $hours . ' heures';
        }

        $days = (int) floor($now->diffInDays($dateTime, true));

        if ($days < 7) {
            if ($days === 1) {
                return 'plus d\'un jour';
            }

            return 'plus de ' . $days . ' jours';
        }

        $weeks = max(1, intdiv($days, 7));

        if ($days < 30) {
            if ($weeks <= 1) {
                return 'plus d\'une semaine';
            }

            return 'plus de ' . $weeks . ' semaines';
        }

        $months = (int) floor($now->diffInMonths($dateTime, true));

        if ($months < 12) {
            if ($months <= 1) {
                return 'plus d\'un mois';
            }

            return 'plus de ' . $months . ' mois';
        }

        $years = (int) floor($now->diffInYears($dateTime, true));

        if ($years <= 1) {
            return 'plus d\'un an';
        }

        return 'plus de ' . $years . ' ans';
    }

    private function formatSinceLabel(?\DateTimeInterface $dateTime): string
    {
        $delay = $this->formatDelayLabel($dateTime);

        if ($delay === 'date inconnue') {
            return 'Date inconnue';
        }

        return 'Depuis ' . $delay;
    }

    private function makeInsight(array $payload): array
    {
        $title = $payload['title'] ?? 'Action';
        $kind = $payload['kind'] ?? 'item';
        $entityId = $payload['entity_id'] ?? Str::slug($title);

        return [
            'id' => $kind . '-' . $entityId,
            'kind' => $kind,
            'severity' => $payload['severity'] ?? 'warning',
            'title' => $title,
            'reason' => $payload['reason'] ?? '',
            'action_label' => $payload['action_label'] ?? 'Ouvrir',
            'href' => $payload['href'] ?? '#',
            'age_label' => $payload['age_label'] ?? null,
            'tags' => $payload['tags'] ?? [],
            'ticket' => $payload['ticket'] ?? null,
            'commande' => $payload['commande'] ?? null,
        ];
    }

    private function buildAgentMentionInsights($user)
    {
        if (! $user) {
            return collect();
        }

        try {
            $notifications = $user->unreadNotifications()
                ->where('type', 'App\\Notifications\\AgentMentionNotification')
                ->latest()
                ->limit(12)
                ->get();
        } catch (Throwable $exception) {
            // If notifications table is not migrated yet, keep dashboard functional.
            return collect();
        }

        if ($notifications->isEmpty()) {
            return collect();
        }

        $ticketIds = $notifications
            ->pluck('data.ticket_id')
            ->filter(fn ($id) => ! is_null($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $ticketsById = Ticket::query()
            ->standardOnly()
            ->whereIn('id', $ticketIds->all())
            ->with([
                'user:id,first_name,last_name',
                'assignee:id,first_name,last_name',
                'category:id,name',
            ])
            ->withCount('messages')
            ->get()
            ->keyBy('id');

        return $notifications->map(function ($notification) use ($ticketsById) {
            $data = is_array($notification->data) ? $notification->data : [];
            $ticketId = (int) ($data['ticket_id'] ?? 0);
            $ticket = $ticketId > 0 ? $ticketsById->get($ticketId) : null;
            $ticketTitle = $data['ticket_title'] ?? ($ticket?->title ?: ('Ticket n°' . ($ticketId ?: '-')));
            $excerpt = trim((string) ($data['excerpt'] ?? ''));
            $baseReason = trim((string) ($data['reason'] ?? 'Mention interne reçue.'));
            $reason = $excerpt !== '' ? ($baseReason . ' « ' . $excerpt . ' »') : $baseReason;
            $href = is_string($data['href'] ?? null) ? $data['href'] : ('/tickets/' . $ticketId);

            return $this->makeInsight([
                'kind' => 'ticket',
                'severity' => 'notification',
                'title' => 'Notification d\'equipe',
                'reason' => $reason,
                'action_label' => 'Voir la notification',
                'href' => $href,
                'entity_id' => 'mention-' . $notification->id,
                'age_label' => $this->formatSinceLabel($notification->created_at),
                'tags' => ['Notification', 'Mention @'],
                'ticket' => $ticket ? $this->serializeTicket($ticket) : [
                    'id' => $ticketId,
                    'title' => $ticketTitle,
                    'status' => null,
                    'priority' => null,
                    'requester_name' => null,
                    'assignee_name' => null,
                    'messages_count' => null,
                    'is_locked' => false,
                    'is_resolved' => false,
                    'created_at' => null,
                    'updated_at' => null,
                ],
            ]);
        });
    }

    private function isAgentContext(): bool
    {
        $user = Auth::user();

        if (! $user || ! $user->agent) {
            return false;
        }

        $sessionPreviewMode = request()->session()->get('preview_mode');
        $previewAsNonAgent = is_string($sessionPreviewMode)
            ? $sessionPreviewMode === 'user'
            : (bool) request()->session()->get('preview_as_non_agent', false);

        return ! $previewAsNonAgent;
    }

    /**
     * Show the application dashboard with ticket stats and recent open tickets.
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $isAgent = $this->isAgentContext();
        $insightConfig = $this->insightConfig();
        $ticketPendingThresholds = $this->resolveTicketPriorityThresholds($insightConfig, 'ticket_pending_hours');
        $ticketLowInfoThresholds = $this->resolveTicketPriorityThresholds($insightConfig, 'ticket_low_info_hours');
        $ticketStalledThresholds = $this->resolveTicketPriorityThresholds($insightConfig, 'ticket_stalled_days');

        if ($isAgent) {
            $agentTickets = Ticket::query()
                ->standardOnly()
                ->where('assignee_id', $user->id)
                ->with([
                    'user:id,first_name,last_name',
                    'assignee:id,first_name,last_name',
                    'category:id,name',
                ])
                ->withCount('messages');
            $agentCommandes = Commande::query()
                ->with(['ticket:id,title,status,priority,updated_at'])
                ->whereHas('ticket', function ($ticketQuery) use ($user) {
                    $ticketQuery->where('assignee_id', $user->id);
                });

            $total = (clone $agentTickets)->count();
            $open = (clone $agentTickets)->where('status', 'open')->count();
            $pending = (clone $agentTickets)->where('status', 'pending')->count();
            $inProgress = (clone $agentTickets)->where('status', 'in_progress')->count();
            $closed = (clone $agentTickets)->where('status', 'closed')->count();
            $highPriority = (clone $agentTickets)
                ->where('priority', 'high')
                ->whereIn('status', ['open', 'pending', 'in_progress'])
                ->count();
            $recentUpdates = (clone $agentTickets)
                ->where('updated_at', '>=', now()->subDays(2))
                ->count();

            $ticketActions = collect()
                ->merge(
                    $this->applyPriorityHoursThreshold((clone $agentTickets)
                        ->where('status', 'pending')
                    , $ticketPendingThresholds)
                        ->orderBy('updated_at')
                        ->limit($insightConfig['max_items_per_rule'])
                        ->get()
                        ->map(function (Ticket $ticket) {
                            return $this->makeInsight([
                                'kind' => 'ticket',
                                'severity' => 'critical',
                                'title' => 'Ticket en attente depuis trop longtemps',
                                'reason' => 'Aucune mise à jour depuis ' . $this->formatDelayLabel($ticket->updated_at) . '. Ce ticket doit être relancé pour débloquer la situation.',
                                'action_label' => 'Ouvrir et relancer',
                                'href' => '/tickets/' . $ticket->id,
                                'entity_id' => 'pending-' . $ticket->id,
                                'age_label' => $this->formatSinceLabel($ticket->updated_at),
                                'tags' => ['En attente', 'Relance prioritaire'],
                                'ticket' => $this->serializeTicket($ticket),
                            ]);
                        })
                )
                ->merge(
                    $this->applyPriorityHoursThreshold((clone $agentTickets)
                        ->whereIn('status', ['open', 'in_progress'])
                    , $ticketLowInfoThresholds)
                        ->orderBy('updated_at')
                        ->limit($insightConfig['max_items_per_rule'])
                        ->get()
                        ->filter(fn (Ticket $ticket) => ($ticket->messages_count ?? 0) <= 1)
                        ->take($insightConfig['max_items_per_rule'])
                        ->map(function (Ticket $ticket) {
                            return $this->makeInsight([
                                'kind' => 'ticket',
                                'severity' => 'warning',
                                'title' => 'Ticket actif sans nouvelle information',
                                'reason' => 'Le ticket n\'a pas assez évolué depuis ' . $this->formatDelayLabel($ticket->updated_at) . '. Ajoutez une réponse ou demandez des précisions.',
                                'action_label' => 'Ajouter une mise à jour',
                                'href' => '/tickets/' . $ticket->id,
                                'entity_id' => 'stale-' . $ticket->id,
                                'age_label' => $this->formatSinceLabel($ticket->updated_at),
                                'tags' => ['Informations manquantes', 'À reprendre'],
                                'ticket' => $this->serializeTicket($ticket),
                            ]);
                        })
                )
                ->merge(
                    $this->applyPriorityDaysThreshold((clone $agentTickets)
                        ->whereIn('status', ['open', 'in_progress'])
                    , $ticketStalledThresholds)
                        ->orderBy('updated_at')
                        ->limit($insightConfig['max_items_per_rule'])
                        ->get()
                        ->map(function (Ticket $ticket) {
                            return $this->makeInsight([
                                'kind' => 'ticket',
                                'severity' => 'warning',
                                'title' => 'Ticket à réévaluer',
                                'reason' => 'Ce ticket est inactif depuis ' . $this->formatDelayLabel($ticket->updated_at) . ' alors qu\'il est encore ouvert ou en cours.',
                                'action_label' => 'Réévaluer le ticket',
                                'href' => '/tickets/' . $ticket->id,
                                'entity_id' => 'requalify-' . $ticket->id,
                                'age_label' => $this->formatSinceLabel($ticket->updated_at),
                                'tags' => ['Inactif', 'À vérifier'],
                                'ticket' => $this->serializeTicket($ticket),
                            ]);
                        })
                );

            $commandActions = collect()
                ->merge(
                    (clone $agentCommandes)
                        ->where(function ($query) {
                            $query->whereNull('fournisseur')
                                ->orWhere('fournisseur', '')
                                ->orWhereNull('command_number')
                                ->orWhere('command_number', '');
                        })
                        ->where('updated_at', '<=', now()->subHours($insightConfig['commande_incomplete_hours']))
                        ->orderBy('updated_at')
                        ->limit($insightConfig['max_items_per_rule'])
                        ->get()
                        ->map(function (Commande $commande) {
                            $ticketTitle = $commande->ticket?->title ?? ('Ticket n°' . $commande->ticket_id);

                            return $this->makeInsight([
                                'kind' => 'commande',
                                'severity' => 'critical',
                                'title' => 'Commande incomplète à compléter',
                                'reason' => 'La commande liée à ' . $ticketTitle . ' est incomplète depuis ' . $this->formatDelayLabel($commande->updated_at) . ' (fournisseur ou numéro manquant).',
                                'action_label' => 'Compléter la commande',
                                'href' => '/commandes/' . $commande->id,
                                'entity_id' => 'incomplete-' . $commande->id,
                                'age_label' => $this->formatSinceLabel($commande->updated_at),
                                'tags' => ['Commande', 'Données manquantes'],
                                'commande' => $this->serializeCommande($commande),
                            ]);
                        })
                )
                ->merge(
                    (clone $agentCommandes)
                        ->whereIn('statut', ['new', 'panier'])
                        ->where('updated_at', '<=', now()->subDays($insightConfig['commande_stalled_days']))
                        ->orderBy('updated_at')
                        ->limit($insightConfig['max_items_per_rule'])
                        ->get()
                        ->map(function (Commande $commande) {
                            $ticketTitle = $commande->ticket?->title ?? ('Ticket n°' . $commande->ticket_id);

                            return $this->makeInsight([
                                'kind' => 'commande',
                                'severity' => 'warning',
                                'title' => 'Commande sans suivi récent',
                                'reason' => 'La commande liée à ' . $ticketTitle . ' n\'a reçu aucune mise à jour depuis ' . $this->formatDelayLabel($commande->updated_at) . '.',
                                'action_label' => 'Mettre à jour la commande',
                                'href' => '/commandes/' . $commande->id,
                                'entity_id' => 'stale-' . $commande->id,
                                'age_label' => $this->formatSinceLabel($commande->updated_at),
                                'tags' => ['Commande', 'Suivi à reprendre'],
                                'commande' => $this->serializeCommande($commande),
                            ]);
                        })
                );

            $actionItems = $ticketActions
                ->merge($commandActions)
                ->merge($this->buildAgentMentionInsights($user))
                ->sortByDesc(function (array $item) {
                    $severityRank = [
                        'notification' => 4,
                        'critical' => 3,
                        'warning' => 2,
                        'info' => 1,
                    ];

                    $updatedAt = $item['ticket']['updated_at'] ?? $item['commande']['updated_at'] ?? null;
                    $stalenessWeight = 0;

                    if ($updatedAt) {
                        $stalenessWeight = now()->diffInHours($updatedAt);
                    }

                    return (($severityRank[$item['severity']] ?? 0) * 10000) + $stalenessWeight;
                })
                ->values();

            $recentTickets = (clone $agentTickets)
                ->orderByDesc('updated_at')
                ->limit($insightConfig['recent_tickets_limit'])
                ->get()
                ->map(fn (Ticket $ticket) => $this->serializeTicket($ticket));

            $assignedTickets = (clone $agentTickets)
                ->whereNotIn('status', ['resolved', 'closed'])
                ->orderByDesc('updated_at')
                ->get()
                ->map(fn (Ticket $ticket) => $this->serializeTicket($ticket));

            return Inertia::render('dashboard', [
                'mode' => 'agent',
                'summary' => [
                    'total' => $total,
                    'open' => $open,
                    'pending' => $pending,
                    'in_progress' => $inProgress,
                    'closed' => $closed,
                    'high_priority' => $highPriority,
                    'recent_updates' => $recentUpdates,
                    'attention_count' => $actionItems->count(),
                ],
                'actionItems' => $actionItems,
                'assignedTickets' => $assignedTickets,
                'recentTickets' => $recentTickets,
                'quickActions' => [
                    [
                        'label' => 'Nouveau ticket',
                        'href' => '/tickets/create',
                        'description' => 'Créer rapidement une nouvelle demande de support.',
                    ],
                    [
                        'label' => 'Tous les tickets',
                        'href' => '/tickets',
                        'description' => 'Voir toute la file avec les filtres complets.',
                    ],
                    [
                        'label' => 'Commandes',
                        'href' => '/commandes',
                        'description' => 'Suivre les commandes liées aux tickets.',
                    ],
                ],
            ]);
        } else {
            $userTicketsQuery = Ticket::query()
                ->standardOnly()
                ->where('user_id', $user->id)
                ->with([
                    'user:id,first_name,last_name',
                    'assignee:id,first_name,last_name',
                    'category:id,name',
                ])
                ->withCount('messages');

            $userTickets = (clone $userTicketsQuery)
                ->orderByDesc('updated_at')
                ->take(10)
                ->get()
                ->map(fn (Ticket $ticket) => $this->serializeTicket($ticket));

            $ticketActions = collect()
                ->merge(
                    $this->applyPriorityHoursThreshold((clone $userTicketsQuery)
                        ->where('status', 'pending')
                    , $ticketPendingThresholds)
                        ->orderBy('updated_at')
                        ->limit($insightConfig['max_items_per_rule'])
                        ->get()
                        ->map(function (Ticket $ticket) {
                            return $this->makeInsight([
                                'kind' => 'ticket',
                                'severity' => 'critical',
                                'title' => 'Votre ticket est en attente depuis trop longtemps',
                                'reason' => 'Aucune mise à jour depuis ' . $this->formatDelayLabel($ticket->updated_at) . '. Une relance peut accélérer le traitement.',
                                'action_label' => 'Relancer le support',
                                'href' => '/tickets/' . $ticket->id,
                                'entity_id' => 'user-pending-' . $ticket->id,
                                'age_label' => $this->formatSinceLabel($ticket->updated_at),
                                'tags' => ['En attente', 'Relance utile'],
                                'ticket' => $this->serializeTicket($ticket),
                            ]);
                        })
                )
                ->merge(
                    $this->applyPriorityHoursThreshold((clone $userTicketsQuery)
                        ->whereIn('status', ['open', 'in_progress'])
                    , $ticketLowInfoThresholds)
                        ->orderBy('updated_at')
                        ->limit($insightConfig['max_items_per_rule'])
                        ->get()
                        ->filter(fn (Ticket $ticket) => ($ticket->messages_count ?? 0) <= 1)
                        ->take($insightConfig['max_items_per_rule'])
                        ->map(function (Ticket $ticket) {
                            return $this->makeInsight([
                                'kind' => 'ticket',
                                'severity' => 'warning',
                                'title' => 'Des informations complémentaires sont attendues',
                                'reason' => 'Le support manque d\'éléments depuis ' . $this->formatDelayLabel($ticket->updated_at) . '. Ajouter des détails peut débloquer le ticket.',
                                'action_label' => 'Compléter mon ticket',
                                'href' => '/tickets/' . $ticket->id,
                                'entity_id' => 'user-info-' . $ticket->id,
                                'age_label' => $this->formatSinceLabel($ticket->updated_at),
                                'tags' => ['Infos à fournir'],
                                'ticket' => $this->serializeTicket($ticket),
                            ]);
                        })
                );

            $attentionCount = $ticketActions->count();

            $userStats = [
                'total' => (clone $userTicketsQuery)->count(),
                'open' => (clone $userTicketsQuery)->where('status', 'open')->count(),
                'pending' => (clone $userTicketsQuery)->where('status', 'pending')->count(),
                'closed' => (clone $userTicketsQuery)->where('status', 'closed')->count(),
                'high_priority' => (clone $userTicketsQuery)->where('priority', 'high')->count(),
                'attention_count' => $attentionCount,
            ];

            return Inertia::render('dashboard', [
                'mode' => 'user',
                'summary' => $userStats,
                'actionItems' => $ticketActions,
                'recentTickets' => $userTickets,
                'quickActions' => [
                    [
                        'label' => 'Créer un ticket',
                        'href' => '/tickets/create',
                        'description' => 'Décrire un nouveau besoin de support.',
                    ],
                    [
                        'label' => 'Mes tickets',
                        'href' => '/tickets',
                        'description' => 'Retrouver tous vos tickets en cours et passés.',
                    ],
                    [
                        'label' => 'Bugs et améliorations',
                        'href' => '/internal-tickets/create?category=bug',
                        'description' => 'Signaler un problème ou une idée.',
                    ],
                ],
            ]);
        }
    }

    public function validateTicketNotifications(Request $request, int $ticketId)
    {
        $user = Auth::user();

        if (! $user || ! $this->isAgentContext()) {
            abort(403);
        }

        try {
            $ownedUnread = $user->unreadNotifications()
                ->where('type', AgentMentionNotification::class)
                ->where('data->ticket_id', $ticketId)
                ->get();
        } catch (Throwable $exception) {
            return back();
        }

        if ($ownedUnread->isEmpty()) {
            return back();
        }

        $messageIds = $ownedUnread
            ->pluck('data.message_id')
            ->filter(fn ($id) => ! is_null($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($messageIds->isEmpty()) {
            return back();
        }

        DatabaseNotification::query()
            ->where('type', AgentMentionNotification::class)
            ->whereIn('data->message_id', $messageIds->all())
            ->whereNull('read_at')
            ->update([
                'read_at' => now(),
                'updated_at' => now(),
            ]);

        return back();
    }
}
