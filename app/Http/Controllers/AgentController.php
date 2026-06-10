<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\User;
use App\Models\Speciality;
use App\Models\Ticket;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AgentController extends Controller
{
    public function __construct()
    {
        // Apply admin middleware to actions that modify agent data
        $this->middleware(\App\Http\Middleware\EnsureUserIsAdmin::class)->only(['create', 'store', 'edit', 'update', 'destroy']);
    }

    public function create()
    {
        // List users who are not yet agents to allow promoting them
        $users = User::whereDoesntHave('agent')->get()->map(function ($u) {
            return [
                'id' => $u->id,
                'name' => $u->name ?? trim(($u->first_name ?? '') . ' ' . ($u->last_name ?? '')),
                'email' => $u->email,
            ];
        });

        return Inertia::render('Agents/Create', ['users' => $users]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'password' => 'required',
        ]);

        // Confirm the current authenticated user's password
        if (!\Illuminate\Support\Facades\Hash::check($data['password'], $request->user()->password)) {
            return back()->withErrors(['password' => 'Mot de passe incorrect'])->withInput();
        }

        // Prevent double-creating an agent record
        if (Agent::where('user_id', $data['user_id'])->exists()) {
            return back()->withErrors(['user_id' => "Cet utilisateur est déjà un agent."]);
        }

        Agent::create([
            'user_id' => $data['user_id'],
            'is_admin' => false,
            'is_active' => true,
        ]);

        return redirect()->route('agents.index')->with('success', 'Agent ajouté.');
    }
    public function index()
    {
        $agents = Agent::with(['user', 'specialities'])->get()->map(function ($a) {
            return [
                'id' => $a->id,
                'user_id' => $a->user_id,
                'user_name' => $a->user?->name ?? null,
                'specialities' => $a->specialities?->pluck('name')->toArray() ?? [],
                'is_admin' => (bool) ($a->is_admin ?? false),
                'is_active' => (bool) ($a->is_active ?? true),
                'created_at' => $a->created_at?->toDateTimeString(),
            ];
        });

        return Inertia::render('Agents/Index', ['agents' => $agents]);
    }

    public function show($id)
    {
        $agent = Agent::with(['user', 'specialities'])->findOrFail($id);
        return Inertia::render('Agents/Edit', ['agent' => $agent]);
    }

    public function edit($id)
    {
        $agent = Agent::with(['user', 'specialities'])->findOrFail($id);

        // Provide list of specialities for the edit form (id + name)
        $specialities = Speciality::all()->map(function ($s) {
            return [
                'id' => $s->id,
                'name' => $s->name,
            ];
        });

        // also pass the agent's currently attached speciality ids
        $agentSpecialityIds = $agent->specialities->pluck('id')->toArray();

        $activeTicketCount = Ticket::query()
            ->standardOnly()
            ->where('assignee_id', $agent->user_id)
            ->whereIn('status', ['open', 'in_progress', 'pending'])
            ->count();

        return Inertia::render('Agents/Edit', [
            'agent' => $agent,
            'specialities' => $specialities,
            'agentSpecialityIds' => $agentSpecialityIds,
            'activeTicketCount' => $activeTicketCount,
        ]);
    }

    public function update(Request $request, $id)
    {
        $agent = Agent::findOrFail($id);
        $wasActive = (bool) ($agent->is_active ?? true);

        $data = $request->validate([
            'speciality_ids' => 'nullable|array',
            'speciality_ids.*' => 'exists:specialities,id',
            'is_admin' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
        ]);

        // sync many-to-many specialities
        $agent->specialities()->sync($data['speciality_ids'] ?? []);

        $isAdmin = $request->has('is_admin') ? $request->boolean('is_admin') : (bool) $agent->is_admin;
        $isActive = $request->has('is_active') ? $request->boolean('is_active') : (bool) ($agent->is_active ?? true);

        $agent->update([
            'is_admin' => $isAdmin,
            'is_active' => $isActive,
        ]);

        $unassignedCount = 0;
        if ($wasActive && !$isActive) {
            $unassignedCount = Ticket::query()
                ->standardOnly()
                ->where('assignee_id', $agent->user_id)
                ->whereIn('status', ['open', 'in_progress', 'pending'])
                ->update(['assignee_id' => null]);
        }

        $message = 'Agent mis à jour.';
        if ($wasActive && !$isActive && $unassignedCount > 0) {
            $message = 'Agent désactivé. ' . $unassignedCount . ' ticket(s) actif(s) ont été désassigné(s).';
        }

        return redirect()->route('agents.index')->with('success', $message);
    }

    public function destroy($id)
    {
        $agent = Agent::findOrFail($id);
        $agent->delete();
        return redirect()->route('agents.index')->with('success', 'Agent supprimé.');
    }
}
