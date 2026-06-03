<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Ticket;
use Illuminate\Support\Facades\Auth;

class DashboardController extends Controller
{
    private function isAgentContext(): bool
    {
        $user = Auth::user();

        if (! $user || ! $user->agent) {
            return false;
        }

        $previewAsNonAgent = (bool) request()->session()->get('preview_as_non_agent', false);

        return ! $previewAsNonAgent;
    }

    /**
     * Show the application dashboard with ticket stats and recent open tickets.
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $isAgent = $this->isAgentContext();

        if ($isAgent) {
            // Agent dashboard: show only tickets assigned to the current agent user
            $agentTickets = Ticket::where('assignee_id', $user->id);

            $total = (clone $agentTickets)->count();
            $open = (clone $agentTickets)->where('status', 'open')->count();
            $pending = (clone $agentTickets)->where('status', 'pending')->count();
            $inProgress = (clone $agentTickets)->where('status', 'in_progress')->count();
            $closed = (clone $agentTickets)->where('status', 'closed')->count();

            $openTickets = (clone $agentTickets)
                ->whereIn('status', ['open', 'pending', 'in_progress'])
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(function ($t) {
                    return [
                        'id' => $t->id,
                        'title' => $t->title ?? null,
                        'status' => $t->status ?? null,
                        'created_at' => $t->created_at ? $t->created_at->toDateTimeString() : null,
                    ];
                });

            return Inertia::render('dashboard', [
                'stats' => [
                    'total' => $total,
                    'open' => $open,
                    'pending' => $pending,
                    'in_progress' => $inProgress,
                    'closed' => $closed,
                ],
                'openTickets' => $openTickets,
            ]);
        } else {
            // Non-agent user dashboard: show only their tickets
            $userTickets = Ticket::where('user_id', $user->id)
                ->orderBy('created_at', 'desc')
                ->take(10)
                ->get()
                ->map(function ($t) {
                    return [
                        'id' => $t->id,
                        'title' => $t->title ?? null,
                        'status' => $t->status ?? null,
                        'priority' => $t->priority ?? null,
                        'created_at' => $t->created_at ? $t->created_at->toDateTimeString() : null,
                    ];
                });

            $userStats = [
                'total' => Ticket::where('user_id', $user->id)->count(),
                'open' => Ticket::where('user_id', $user->id)->where('status', 'open')->count(),
                'closed' => Ticket::where('user_id', $user->id)->where('status', 'closed')->count(),
            ];

            return Inertia::render('dashboard', [
                'userTickets' => $userTickets,
                'userStats' => $userStats,
            ]);
        }
    }
}
