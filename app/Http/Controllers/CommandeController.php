<?php

namespace App\Http\Controllers;

use App\Models\Commande;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class CommandeController extends Controller
{
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
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('command_number', 'like', "%{$search}%")
                    ->orWhere('fournisseur', 'like', "%{$search}%")
                    ->orWhere('invoice_id', 'like', "%{$search}%");
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
        $tickets = Ticket::select('id', 'title', 'uuid')->get();

        return Inertia::render('Commandes/Create', [
            'users' => $users,
            'tickets' => $tickets,
            'ticketId' => $request->query('ticket_id'),
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
        $tickets = Ticket::select('id', 'title', 'uuid')->get();

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

        // Vérifier que les champs requis sont remplis selon le statut
        if ($validated['statut'] !== 'new' && empty($commande->fournisseur)) {
            return back()->withErrors(['statut' => 'Le fournisseur doit être renseigné avant de passer au statut "' . $validated['statut'] . '".']);
        }

        if (in_array($validated['statut'], ['commandé', 'réceptionner', 'traité']) && empty($commande->command_number)) {
            return back()->withErrors(['statut' => 'Le numéro de commande doit être renseigné avant de passer au statut "' . $validated['statut'] . '".']);
        }

        $commande->update(['statut' => $validated['statut']]);

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
        $tickets = Ticket::select('id', 'title', 'uuid')->get();

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
