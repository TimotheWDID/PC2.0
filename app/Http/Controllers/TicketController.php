<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Ticket;
use App\Models\Commande;
use Coderflex\LaravelTicket\Models\Category;
use Illuminate\Support\Facades\Auth;
use App\Support\TicketLabelSettings;

class TicketController extends Controller
{
    private function authorizeTicketAccess(Ticket $ticket): void
    {
        $user = Auth::user();

        if (!$user) {
            abort(403, 'Acces non autorise.');
        }

        if ($user->agent) {
            return;
        }

        if ((int) $ticket->user_id !== (int) $user->id) {
            abort(403, 'Acces non autorise.');
        }
    }
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Ticket::query()->with('user');
        $user = Auth::user();

        if (!$user) {
            abort(403, 'Acces non autorise.');
        }

        if (!$user->agent) {
            $query->where('user_id', $user->id);
        }

        // Filter by status if provided
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $rawTickets = $query->get();

        $linkedCommandes = Commande::select('id', 'ticket_id', 'nom')
            ->whereNotNull('ticket_id')
            ->whereIn('ticket_id', $rawTickets->pluck('id'))
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('ticket_id')
            ->map(fn($group) => $group->first());

        $tickets = $rawTickets->map(function ($t) use ($linkedCommandes) {
            $commande = $linkedCommandes->get($t->id);

            return [
                'id' => $t->id,
                'title' => $t->title ?? null,
                'status' => $t->status ?? null,
                'created_at' => $t->created_at ? $t->created_at->toDateTimeString() : null,
                'user' => $t->user ? [
                    'id' => $t->user->id,
                    'name' => $t->user->first_name . ' ' . $t->user->last_name,
                ] : null,
                'commande' => $commande ? [
                    'id' => $commande->id,
                    'nom' => $commande->nom,
                ] : null,
            ];
        });

        $linkableCommandes = Commande::with('user:id,first_name,last_name,email')
            ->select('id', 'ticket_id', 'nom', 'fournisseur', 'command_number', 'user_id')
            ->whereNull('ticket_id')
            ->orderByDesc('created_at')
            ->limit(300)
            ->get()
            ->map(function ($commande) {
                return [
                    'id' => $commande->id,
                    'nom' => $commande->nom,
                    'fournisseur' => $commande->fournisseur,
                    'command_number' => $commande->command_number,
                    'user_name' => $commande->user ? $commande->user->name : null,
                    'user_email' => $commande->user ? $commande->user->email : null,
                ];
            });

        return Inertia::render('Tickets/Index', [
            'tickets' => $tickets,
            'linkableCommandes' => $linkableCommandes,
            'currentStatus' => $request->status ?? null,
        ]);
    }

    /**
     * Link an existing commande to a ticket.
     */
    public function linkCommande(Request $request, Ticket $ticket)
    {
        $this->authorizeTicketAccess($ticket);

        $validated = $request->validate([
            'commande_id' => 'required|exists:commandes,id',
        ]);

        $commande = Commande::findOrFail($validated['commande_id']);

        if (!is_null($commande->ticket_id) && (int) $commande->ticket_id !== (int) $ticket->id) {
            return back()->withErrors([
                'commande_id' => 'Cette commande est deja liee a un autre ticket.',
            ]);
        }

        $commande->update([
            'ticket_id' => $ticket->id,
        ]);

        return back()->with('success', 'Commande liee au ticket avec succes.');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $categories = Category::all()->map(fn($c) => [
            'id' => $c->id,
            'name' => $c->name,
        ]);

        $currentUser = Auth::user();
        $isAgent = $currentUser && $currentUser->agent;

        $users = [];
        if ($isAgent) {
            $users = \App\Models\User::whereDoesntHave('agent')->get()->map(fn($u) => [
                'id' => $u->id,
                'name' => $u->first_name . ' ' . $u->last_name,
                'email' => $u->email,
            ])->toArray();
        }

        return Inertia::render('Tickets/Create', [
            'categories' => $categories,
            'isAgent' => $isAgent,
            'users' => $users,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $currentUser = Auth::user();
        $isAgent = $currentUser && $currentUser->agent;

        $rules = [
            'title' => 'required|string|max:255',
            'message' => 'nullable|string',
            'category_id' => 'nullable|integer',
        ];

        // Si admin, il doit spécifier un utilisateur
        if ($isAgent) {
            $rules['user_selection'] = 'required|in:existing,new';
            $rules['user_id'] = 'nullable|integer';
            $rules['user_email'] = 'nullable|email|max:255';
        }

        $data = $request->validate($rules);

        $ticket = new Ticket();

        // Déterminer l'user_id du ticket
        if ($isAgent && $data['user_selection'] === 'new') {
            // Créer un nouvel utilisateur
            $address = $request->input('user_address', '');
            $postalCode = $request->input('user_postal_code', '');
            $city = $request->input('user_city', '');

            // Combiner les champs d'adresse
            $fullAddress = trim($address . ' ' . $postalCode . ' ' . $city);

            $email = $data['user_email'] ?? null;
            // Ne pas créer d'email automatique, laisser null si non fourni
            $email = !empty($email) ? $email : null;

            // Si email est fourni, vérifier s'il existe déjà
            if ($email) {
                $user = \App\Models\User::firstOrCreate(
                    ['email' => $email],
                    [
                        'first_name' => $request->input('user_first_name', 'Client'),
                        'last_name' => $request->input('user_last_name', ''),
                        'password' => bcrypt('defaultpassword'),
                        'phone' => $request->input('user_phone', ''),
                        'address' => $fullAddress,
                        'default_notification_preference' => 'Email',
                    ]
                );
            } else {
                // Créer sans email
                $user = \App\Models\User::create([
                    'first_name' => $request->input('user_first_name', 'Client'),
                    'last_name' => $request->input('user_last_name', ''),
                    'password' => bcrypt('defaultpassword'),
                    'phone' => $request->input('user_phone', ''),
                    'address' => $fullAddress,
                    'email' => null,
                    'default_notification_preference' => $request->input('user_phone') ? 'SMS' : 'None',
                ]);
            }
            $ticket->user_id = $user->id;
        } elseif ($isAgent && $data['user_selection'] === 'existing' && !empty($data['user_id'])) {
            // Utiliser un utilisateur existant
            $ticket->user_id = $data['user_id'];
        } else {
            // Utiliser l'utilisateur courant
            $ticket->user_id = Auth::id() ?? 1;
        }

        $ticket->title = $data['title'];
        $ticket->message = $data['message'] ?? null;
        $ticket->priority = $request->input('priority', 'low');
        $ticket->status = $request->input('status', 'open');
        $ticket->save();

        if (!empty($data['category_id']) && method_exists($ticket, 'categories')) {
            try {
                $ticket->categories()->attach($data['category_id']);
            } catch (\Exception $e) {
                // ignore attach failures
            }
        }

        if ($request->boolean('print_label')) {
            return redirect()->route('tickets.printLabel', $ticket->id);
        }

        // Redirect to dashboard after creating a ticket
        return redirect()->route('dashboard');
    }

    /**
     * Printer settings page for ticket labels.
     */
    public function printSettings()
    {
        return Inertia::render('Tickets/PrinterSettings');
    }

    /**
     * Printable label view for a ticket.
     */
    public function printLabel(string $id)
    {
        $ticket = Ticket::with('user', 'category')->findOrFail($id);
        $this->authorizeTicketAccess($ticket);

        return Inertia::render('Tickets/PrintLabel', [
            'ticket' => [
                'id' => $ticket->id,
                'title' => $ticket->title ?? null,
                'message' => $ticket->message ?? null,
                'created_at' => $ticket->created_at ? $ticket->created_at->format('d/m/Y H:i') : null,
                'priority' => $ticket->priority ?? null,
                'status' => $ticket->status ?? null,
                'user' => $ticket->user ? [
                    'name' => $ticket->user->first_name . ' ' . $ticket->user->last_name,
                    'email' => $ticket->user->email,
                    'phone' => $ticket->user->phone,
                    'address' => $ticket->user->address,
                ] : null,
                'category' => $ticket->category ? [
                    'name' => $ticket->category->name,
                ] : null,
                'qr_payload' => url(route('tickets.show', $ticket->id)),
            ],
            'labelSettings' => TicketLabelSettings::load(),
        ]);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $ticket = Ticket::findOrFail($id);
        $this->authorizeTicketAccess($ticket);
        $ticket->load(['user', 'assignee', 'category']);

        $categories = Category::all()->map(fn($c) => [
            'id' => $c->id,
            'name' => $c->name,
        ]);

        $agents = \App\Models\User::whereHas('agent')->get()->map(fn($u) => [
            'id' => $u->id,
            'name' => $u->first_name . ' ' . $u->last_name,
        ]);

        // Récupérer les commandes liées à ce ticket
        $commandes = \App\Models\Commande::where('ticket_id', $ticket->id)
            ->with('user')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn($c) => [
                'id' => $c->id,
                'nom' => $c->nom,
                'fournisseur' => $c->fournisseur,
                'command_number' => $c->command_number,
                'invoice_id' => $c->invoice_id,
                'statut' => $c->statut,
                'created_at' => $c->created_at->toDateTimeString(),
                'user' => $c->user ? [
                    'id' => $c->user->id,
                    'name' => $c->user->first_name . ' ' . $c->user->last_name,
                ] : null,
            ]);

        return Inertia::render('Tickets/Show', [
            'ticket' => [
                'id' => $ticket->id,
                'title' => $ticket->title,
                'message' => $ticket->message,
                'status' => $ticket->status,
                'priority' => $ticket->priority,
                'invoice_id' => $ticket->invoice_id,
                'notify_by' => $ticket->notify_by,
                'contact_phone' => $ticket->contact_phone,
                'contact_email' => $ticket->contact_email,
                'is_resolved' => $ticket->is_resolved,
                'is_locked' => $ticket->is_locked,
                'created_at' => $ticket->created_at ? $ticket->created_at->toDateTimeString() : null,
                'user' => $ticket->user ? [
                    'id' => $ticket->user->id,
                    'first_name' => $ticket->user->first_name,
                    'last_name' => $ticket->user->last_name,
                    'name' => $ticket->user->first_name . ' ' . $ticket->user->last_name,
                    'email' => $ticket->user->email,
                    'phone' => $ticket->user->phone ?? null,
                    'address' => $ticket->user->address ?? null,
                    'internal_note' => $ticket->user->internal_note ?? null,
                    'email_verified_at' => $ticket->user->email_verified_at ? $ticket->user->email_verified_at->toDateTimeString() : null,
                ] : null,
                'assignee' => $ticket->assignee ? [
                    'id' => $ticket->assignee->id,
                    'first_name' => $ticket->assignee->first_name,
                    'last_name' => $ticket->assignee->last_name,
                    'name' => $ticket->assignee->first_name . ' ' . $ticket->assignee->last_name,
                    'email' => $ticket->assignee->email,
                    'phone' => $ticket->assignee->phone ?? null,
                    'address' => $ticket->assignee->address ?? null,
                ] : null,
                'category' => $ticket->category ? [
                    'id' => $ticket->category->id,
                    'name' => $ticket->category->name,
                ] : null,
            ],
            'categories' => $categories,
            'agents' => $agents,
            'commandes' => $commandes,
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        $ticket = Ticket::findOrFail($id);
        $this->authorizeTicketAccess($ticket);
        $categories = Category::all()->map(fn($c) => [
            'id' => $c->id,
            'name' => $c->name,
        ]);

        $agents = \App\Models\User::whereHas('agent')->get()->map(fn($u) => [
            'id' => $u->id,
            'name' => $u->first_name . ' ' . $u->last_name,
        ]);

        return Inertia::render('Tickets/Edit', [
            'ticket' => [
                'id' => $ticket->id,
                'title' => $ticket->title,
                'message' => $ticket->message,
                'status' => $ticket->status,
                'priority' => $ticket->priority,
                'category_id' => $ticket->category_id,
                'assignee_id' => $ticket->assignee_id,
                'invoice_id' => $ticket->invoice_id,
                'notify_by' => $ticket->notify_by,
                'contact_phone' => $ticket->contact_phone,
                'contact_email' => $ticket->contact_email,
                'is_resolved' => $ticket->is_resolved,
                'is_locked' => $ticket->is_locked,
            ],
            'categories' => $categories,
            'agents' => $agents,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $ticket = Ticket::findOrFail($id);
        $this->authorizeTicketAccess($ticket);

        $data = $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'nullable|string',
            'category_id' => 'nullable|integer',
            'assignee_id' => 'nullable|integer',
            'invoice_id' => 'nullable|string|max:255',
            'notify_by' => 'nullable|in:SMS,Email,None',
            'contact_phone' => 'nullable|string|max:255',
            'contact_email' => 'nullable|email|max:255',
            'is_resolved' => 'nullable|boolean',
            'is_locked' => 'nullable|boolean',
        ]);

        $ticket->title = $data['title'];
        $ticket->message = $data['message'] ?? null;
        $ticket->priority = $request->input('priority', $ticket->priority);
        $ticket->status = $request->input('status', $ticket->status);
        $ticket->assignee_id = $data['assignee_id'] ?? null;
        $ticket->invoice_id = $data['invoice_id'] ?? null;
        $ticket->notify_by = $data['notify_by'] ?? 'None';
        $ticket->contact_phone = $data['contact_phone'] ?? null;
        $ticket->contact_email = $data['contact_email'] ?? null;
        $ticket->is_resolved = $data['is_resolved'] ?? false;
        $ticket->is_locked = $data['is_locked'] ?? false;

        // Si assignee_id est 0 (Aucun), le mettre à null
        if ($ticket->assignee_id == 0) {
            $ticket->assignee_id = null;
        }

        $ticket->save();

        if (isset($data['category_id']) && method_exists($ticket, 'categories')) {
            try {
                $ticket->categories()->sync([$data['category_id']]);
            } catch (\Exception $e) {
                // ignore
            }
        }

        return redirect()->route('tickets.show', $ticket->id);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $ticket = Ticket::findOrFail($id);
        $this->authorizeTicketAccess($ticket);
        $ticket->delete();

        return redirect()->route('tickets.index');
    }

    /**
     * Update ticket status only
     */
    public function updateStatus(Request $request, string $id)
    {
        $ticket = Ticket::findOrFail($id);
        $this->authorizeTicketAccess($ticket);

        $data = $request->validate([
            'status' => 'required|in:open,in_progress,pending,resolved,closed',
        ]);

        $ticket->status = $data['status'];
        $ticket->save();

        return back();
    }

    /**
     * Update ticket priority only
     */
    public function updatePriority(Request $request, string $id)
    {
        $ticket = Ticket::findOrFail($id);
        $this->authorizeTicketAccess($ticket);

        $data = $request->validate([
            'priority' => 'required|in:low,medium,high',
        ]);

        $ticket->priority = $data['priority'];
        $ticket->save();

        return back();
    }
}
