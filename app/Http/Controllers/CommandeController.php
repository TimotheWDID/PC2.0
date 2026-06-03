<?php

namespace App\Http\Controllers;

use App\Models\Commande;
use App\Models\Ticket;
use App\Models\TicketTimelineEvent;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class CommandeController extends Controller
{
    private const TRACKED_COMMANDE_FIELDS = [
        'ticket_id',
        'nom',
        'fournisseur',
        'command_number',
        'invoice_id',
        'statut',
    ];

    private const TRACKED_COMMANDE_LABELS = [
        'ticket_id' => 'Ticket lie',
        'nom' => 'Nom',
        'fournisseur' => 'Fournisseur',
        'command_number' => 'Numero de commande',
        'invoice_id' => 'Numero de facture',
        'statut' => 'Statut commande',
    ];

    private function logCommandeTimeline(Ticket $ticket, string $eventType, string $summary, array $details = []): void
    {
        $user = Auth::user();

        if (!$user || !$user->agent) {
            return;
        }

        TicketTimelineEvent::create([
            'ticket_id' => $ticket->id,
            'technician_id' => $user->id,
            'event_type' => $eventType,
            'summary' => $summary,
            'details' => !empty($details) ? $details : null,
            'happened_at' => now(),
        ]);
    }

    private function formatCommandeValue(string $field, mixed $value): mixed
    {
        if ($field === 'ticket_id') {
            return $value ? ('#' . $value) : null;
        }

        if ($value === null || $value === '') {
            return null;
        }

        return $value;
    }

    private function buildCommandePrerequisites(string $targetStatus, Commande $commande): array
    {
        $requirements = [];

        if ($targetStatus !== 'new') {
            $requirements[] = [
                'name' => 'fournisseur',
                'required' => true,
                'met' => !empty($commande->fournisseur),
            ];
        }

        if (in_array($targetStatus, ['commandé', 'réceptionner', 'traité'], true)) {
            $requirements[] = [
                'name' => 'command_number',
                'required' => true,
                'met' => !empty($commande->command_number),
            ];
        }

        return $requirements;
    }
    private function getTicketOptions()
    {
        return Ticket::with(['user:id,first_name,last_name,email,phone'])
            ->select('id', 'title', 'uuid', 'user_id')
            ->orderByDesc('id')
            ->get()
            ->map(function ($ticket) {
                return [
                    'id' => $ticket->id,
                    'title' => $ticket->title,
                    'uuid' => $ticket->uuid,
                    'user' => $ticket->user ? [
                        'id' => $ticket->user->id,
                        'name' => $ticket->user->name,
                        'first_name' => $ticket->user->first_name,
                        'last_name' => $ticket->user->last_name,
                        'email' => $ticket->user->email,
                        'phone' => $ticket->user->phone,
                    ] : null,
                ];
            })
            ->values();
    }

    public function __construct()
    {
        $this->middleware(function ($request, $next) {
            $user = Auth::user();
            if (!$user || !$user->agent) {
                abort(403, 'Accès réservé aux agents uniquement.');
            }
            return $next($request);
        });
    }

    /**
     * Display a listing of the commandes.
     */
    public function index(Request $request)
    {
        $query = Commande::with(['user', 'ticket']);

        // Filter by status if provided
        if ($request->has('statut') && $request->statut !== '') {
            $query->where('statut', $request->statut);
        }

        // Filter by fournisseur if provided
        if ($request->has('fournisseur') && $request->fournisseur !== '') {
            $query->byFournisseur($request->fournisseur);
        }

        // Search functionality
        if ($request->has('search') && $request->search !== '') {
            $search = trim((string) $request->search);
            $searchNumeric = is_numeric($search) ? (int) $search : null;
            $query->where(function ($q) use ($search, $searchNumeric) {
                $q->where('command_number', 'like', "%{$search}%")
                    ->orWhere('nom', 'like', "%{$search}%")
                    ->orWhere('fournisseur', 'like', "%{$search}%")
                    ->orWhere('invoice_id', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($userQuery) use ($search) {
                        $userQuery->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    })
                    ->orWhereHas('ticket', function ($ticketQuery) use ($search) {
                        $ticketQuery->where('title', 'like', "%{$search}%");
                    });

                if (!is_null($searchNumeric)) {
                    $q->orWhere('id', $searchNumeric)
                        ->orWhere('ticket_id', $searchNumeric)
                        ->orWhere('user_id', $searchNumeric);
                }
            });
        }

        $commandes = $query->orderBy('created_at', 'desc')->paginate(15);

        return Inertia::render('Commandes/Index', [
            'commandes' => $commandes,
            'filters' => $request->only(['statut', 'fournisseur', 'search']),
        ]);
    }

    /**
     * Show the form for creating a new commande.
     */
    public function create(Request $request)
    {
        $users = User::select('id', 'first_name', 'last_name', 'email')->get()->map(function ($user) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ];
        });
        $tickets = $this->getTicketOptions();
        $ticketId = $request->query('ticket_id');
        $ticketUserId = null;

        if (!empty($ticketId)) {
            $ticket = Ticket::select('id', 'user_id')->find($ticketId);
            $ticketUserId = $ticket ? $ticket->user_id : null;
        }

        return Inertia::render('Commandes/Create', [
            'users' => $users,
            'tickets' => $tickets,
            'ticketId' => $ticketId,
            'ticketUserId' => $ticketUserId,
        ]);
    }

    /**
     * Store a newly created commande in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'ticket_id' => 'nullable|exists:tickets,id',
            'nom' => 'required|string|max:255',
            'fournisseur' => [
                $request->statut === 'new' ? 'nullable' : 'required',
                'string',
                'max:255'
            ],
            'command_number' => [
                in_array($request->statut, ['new', 'panier']) ? 'nullable' : 'required',
                'string',
                'max:255'
            ],
            'invoice_id' => 'nullable|string|max:255',
            'statut' => 'required|in:new,panier,commandé,réceptionner,traité',
        ]);

        $commande = Commande::create($validated);

        if (!empty($commande->ticket_id)) {
            $ticket = Ticket::find($commande->ticket_id);

            if ($ticket) {
                $this->logCommandeTimeline(
                    $ticket,
                    'commande_created_direct',
                    'Commande creee et liee au ticket',
                    [
                        'source' => 'commande_direct',
                        'commande_id' => $commande->id,
                        'nom' => $commande->nom,
                        'fournisseur' => $commande->fournisseur,
                        'command_number' => $commande->command_number,
                        'statut' => $commande->statut,
                    ]
                );
            }
        }

        return redirect()->route('commandes.show', $commande->id)
            ->with('success', 'Commande créée avec succès.');
    }

    /**
     * Display the specified commande.
     */
    public function show(Commande $commande)
    {
        $commande->load(['user', 'ticket']);

        return Inertia::render('Commandes/Show', [
            'commande' => $commande,
        ]);
    }

    /**
     * Show the form for editing the specified commande.
     */
    public function edit(Commande $commande)
    {
        $users = User::select('id', 'first_name', 'last_name', 'email')->get()->map(function ($user) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ];
        });
        $tickets = $this->getTicketOptions();

        return Inertia::render('Commandes/Edit', [
            'commande' => $commande,
            'users' => $users,
            'tickets' => $tickets,
        ]);
    }

    /**
     * Update the specified commande in storage.
     */
    public function update(Request $request, Commande $commande)
    {
        $originalValues = [];
        foreach (self::TRACKED_COMMANDE_FIELDS as $field) {
            $originalValues[$field] = $commande->{$field};
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'ticket_id' => 'nullable|exists:tickets,id',
            'nom' => 'required|string|max:255',
            'fournisseur' => [
                $request->statut === 'new' ? 'nullable' : 'required',
                'string',
                'max:255'
            ],
            'command_number' => [
                in_array($request->statut, ['new', 'panier']) ? 'nullable' : 'required',
                'string',
                'max:255'
            ],
            'invoice_id' => 'nullable|string|max:255',
            'statut' => 'required|in:new,panier,commandé,réceptionner,traité',
        ]);

        $commande->update($validated);

        $changes = [];
        foreach (self::TRACKED_COMMANDE_FIELDS as $field) {
            if (!$commande->wasChanged($field)) {
                continue;
            }

            $changes[] = [
                'field' => $field,
                'label' => self::TRACKED_COMMANDE_LABELS[$field] ?? $field,
                'before' => $this->formatCommandeValue($field, $originalValues[$field] ?? null),
                'after' => $this->formatCommandeValue($field, $commande->{$field}),
            ];
        }

        if (!empty($changes)) {
            $linkedTicketIds = array_values(array_unique(array_filter([
                $originalValues['ticket_id'] ?? null,
                $commande->ticket_id,
            ])));

            foreach ($linkedTicketIds as $ticketId) {
                $ticket = Ticket::find($ticketId);
                if (!$ticket) {
                    continue;
                }

                $this->logCommandeTimeline(
                    $ticket,
                    'commande_updated_direct',
                    'Commande modifiee directement',
                    [
                        'source' => 'commande_direct',
                        'commande_id' => $commande->id,
                        'nom' => $commande->nom,
                        'changes' => $changes,
                        'prerequisites' => $this->buildCommandePrerequisites($commande->statut, $commande),
                    ]
                );
            }
        }

        return redirect()->route('commandes.show', $commande->id)
            ->with('success', 'Commande mise à jour avec succès.');
    }

    /**
     * Remove the specified commande from storage.
     */
    public function destroy(Commande $commande)
    {
        $commande->delete();

        return redirect()->route('commandes.index')
            ->with('success', 'Commande supprimée avec succès.');
    }

    /**
     * Update the status of the specified commande.
     */
    public function updateStatus(Request $request, Commande $commande)
    {
        $validated = $request->validate([
            'statut' => 'required|in:new,panier,commandé,réceptionner,traité',
        ]);

        $previousStatus = $commande->statut;

        // Vérifier que les champs requis sont remplis selon le statut
        if ($validated['statut'] !== 'new' && empty($commande->fournisseur)) {
            return back()->withErrors(['statut' => 'Le fournisseur doit être renseigné avant de passer au statut "' . $validated['statut'] . '".']);
        }

        if (in_array($validated['statut'], ['commandé', 'réceptionner', 'traité']) && empty($commande->command_number)) {
            return back()->withErrors(['statut' => 'Le numéro de commande doit être renseigné avant de passer au statut "' . $validated['statut'] . '".']);
        }

        $commande->update(['statut' => $validated['statut']]);

        if (!empty($commande->ticket_id) && $previousStatus !== $commande->statut) {
            $ticket = Ticket::find($commande->ticket_id);

            if ($ticket) {
                $this->logCommandeTimeline(
                    $ticket,
                    'commande_status_changed_direct',
                    'Statut de commande modifie directement',
                    [
                        'source' => 'commande_direct',
                        'commande_id' => $commande->id,
                        'nom' => $commande->nom,
                        'before' => $previousStatus,
                        'after' => $commande->statut,
                        'prerequisites' => $this->buildCommandePrerequisites($commande->statut, $commande),
                    ]
                );
            }
        }

        return back()->with('success', 'Statut mis à jour avec succès.');
    }

    /**
     * Show the form for creating bulk commandes.
     */
    public function createBulk()
    {
        $users = User::select('id', 'first_name', 'last_name', 'email')->get()->map(function ($user) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ];
        });
        $tickets = $this->getTicketOptions();

        return Inertia::render('Commandes/CreateBulk', [
            'users' => $users,
            'tickets' => $tickets,
        ]);
    }

    /**
     * Store bulk commandes.
     */
    public function bulkStore(Request $request)
    {
        $validated = $request->validate([
            'fournisseur' => 'required|string|max:255',
            'command_number' => 'required|string|max:255',
            'items' => 'required|array|min:1',
            'items.*.nom' => 'required|string|max:255',
            'items.*.user_id' => 'required|exists:users,id',
            'items.*.ticket_id' => 'nullable|exists:tickets,id',
            'items.*.invoice_id' => 'nullable|string|max:255',
        ]);

        $createdCount = 0;

        foreach ($validated['items'] as $item) {
            Commande::create([
                'user_id' => $item['user_id'],
                'ticket_id' => $item['ticket_id'] ?? null,
                'nom' => $item['nom'],
                'fournisseur' => $validated['fournisseur'],
                'command_number' => $validated['command_number'],
                'invoice_id' => $item['invoice_id'] ?? null,
                'statut' => 'commandé',
            ]);
            $createdCount++;
        }

        return redirect()->route('commandes.index')
            ->with('success', "{$createdCount} commande(s) créée(s) avec succès.");
    }
}
