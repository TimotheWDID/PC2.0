<?php

namespace App\Http\Controllers;

use App\Models\InternalTicket;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class InternalTicketController extends Controller
{
    private function ensureAgentOrAbort(): \App\Models\User
    {
        $user = Auth::user();

        if (!$user || !($user->agent ?? false)) {
            abort(403, 'Acces reserve aux techniciens.');
        }

        return $user;
    }

    public function index(): Response
    {
        $user = Auth::user();

        abort_unless($user, 403, 'Acces non autorise.');

        $showProcessed = $requestShowProcessed = request()->boolean('show_processed');

        $query = InternalTicket::query()
            ->with(['user:id,first_name,last_name,email', 'processedBy:id,first_name,last_name'])
            ->latest();

        if (!($user->agent ?? false)) {
            $query->where('user_id', $user->id);
        }

        if (!$requestShowProcessed) {
            $query->whereNull('processed_at');
        }

        $tickets = $query
            ->limit(200)
            ->get()
            ->map(fn (InternalTicket $ticket) => [
                'id' => $ticket->id,
                'title' => $ticket->title,
                'description' => $ticket->description,
                'category' => $ticket->category,
                'category_label' => InternalTicket::labelFor($ticket->category),
                'created_at' => $ticket->created_at?->toIso8601String(),
                'processed_at' => $ticket->processed_at?->toIso8601String(),
                'processed_by' => $ticket->processedBy ? trim(($ticket->processedBy->first_name ?? '') . ' ' . ($ticket->processedBy->last_name ?? '')) : null,
                'requester' => $ticket->user ? [
                    'id' => $ticket->user->id,
                    'name' => trim(($ticket->user->first_name ?? '') . ' ' . ($ticket->user->last_name ?? '')),
                    'email' => $ticket->user->email,
                ] : null,
            ])
            ->values();

        return Inertia::render('InternalTickets/Index', [
            'tickets' => $tickets,
            'isAgent' => (bool) $user->agent,
            'showProcessed' => $showProcessed,
        ]);
    }

    public function create(Request $request): Response
    {
        $user = Auth::user();

        abort_unless($user, 403, 'Acces non autorise.');

        $requestedCategory = (string) ($request->query('category') ?? $request->query('ticket_kind') ?? InternalTicket::CATEGORY_BUG);
        $defaultCategory = in_array($requestedCategory, InternalTicket::allowedCategories(), true)
            ? $requestedCategory
            : InternalTicket::CATEGORY_BUG;

        return Inertia::render('InternalTickets/Create', [
            'categories' => collect(InternalTicket::CATEGORY_LABELS)
                ->map(fn (string $label, string $value) => [
                    'value' => $value,
                    'label' => $label,
                ])
                ->values(),
            'defaultCategory' => $defaultCategory,
            'defaultTitle' => trim((string) $request->query('report_title', '')),
            'defaultDescription' => trim((string) $request->query('report_message', '')),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = Auth::user();

        abort_unless($user, 403, 'Acces non autorise.');

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'category' => ['required', Rule::in(InternalTicket::allowedCategories())],
        ]);

        $ticket = InternalTicket::create([
            'user_id' => $user->id,
            'category' => $data['category'],
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
        ]);

        return redirect()
            ->route('internalTickets.show', $ticket)
            ->with('success', 'Ticket interne cree.');
    }

    public function show(InternalTicket $internalTicket): Response
    {
        $user = Auth::user();

        abort_unless($user, 403, 'Acces non autorise.');

        if (!($user->agent ?? false) && (int) $internalTicket->user_id !== (int) $user->id) {
            abort(403, 'Acces non autorise.');
        }

        $internalTicket->load(['user:id,first_name,last_name,email', 'processedBy:id,first_name,last_name,email']);

        return Inertia::render('InternalTickets/Show', [
            'ticket' => [
                'id' => $internalTicket->id,
                'title' => $internalTicket->title,
                'description' => $internalTicket->description,
                'category' => $internalTicket->category,
                'category_label' => InternalTicket::labelFor($internalTicket->category),
                'created_at' => $internalTicket->created_at?->toIso8601String(),
                'processed_at' => $internalTicket->processed_at?->toIso8601String(),
                'processed_by' => $internalTicket->processedBy ? [
                    'id' => $internalTicket->processedBy->id,
                    'name' => trim(($internalTicket->processedBy->first_name ?? '') . ' ' . ($internalTicket->processedBy->last_name ?? '')),
                    'email' => $internalTicket->processedBy->email,
                ] : null,
                'requester' => $internalTicket->user ? [
                    'id' => $internalTicket->user->id,
                    'name' => trim(($internalTicket->user->first_name ?? '') . ' ' . ($internalTicket->user->last_name ?? '')),
                    'email' => $internalTicket->user->email,
                ] : null,
            ],
            'canProcess' => (bool) ($user->agent ?? false),
        ]);
    }

    public function process(InternalTicket $internalTicket): RedirectResponse
    {
        $user = $this->ensureAgentOrAbort();

        if (!$internalTicket->processed_at) {
            $internalTicket->forceFill([
                'processed_at' => now(),
                'processed_by_id' => $user->id,
            ])->save();
        }

        return redirect()
            ->route('internalTickets.index')
            ->with('success', 'Ticket interne traite.');
    }
}
