<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Ticket;
use Illuminate\Support\Facades\Auth;

class DashboardController extends Controller
{
    /**
     * Show the application dashboard with ticket stats and recent open tickets.
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $isAgent = $user && $user->agent;

        if ($isAgent) {
            // Agent dashboard: show all tickets stats
            $total = Ticket::count();
            $open = Ticket::where('status', 'open')->count();
            $pending = Ticket::where('status', 'pending')->count();
            $inProgress = Ticket::where('status', 'in_progress')->count();
            $closed = Ticket::where('status', 'closed')->count();

            $openTickets = Ticket::whereIn('status', ['open', 'pending', 'in_progress'])
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
