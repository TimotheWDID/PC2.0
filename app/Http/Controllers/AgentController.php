<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\User;
use App\Models\Speciality;
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

        return Inertia::render('Agents/Edit', ['agent' => $agent, 'specialities' => $specialities, 'agentSpecialityIds' => $agentSpecialityIds]);
    }

    public function update(Request $request, $id)
    {
        $agent = Agent::findOrFail($id);
        $data = $request->validate([
            'speciality_ids' => 'nullable|array',
            'speciality_ids.*' => 'exists:specialities,id',
            'is_admin' => 'sometimes|boolean',
        ]);

        // sync many-to-many specialities
        $agent->specialities()->sync($data['speciality_ids'] ?? []);

        $agent->update([
            'is_admin' => !empty($data['is_admin']),
        ]);

        return redirect()->route('agents.index')->with('success', 'Agent mis à jour.');
    }

    public function destroy($id)
    {
        $agent = Agent::findOrFail($id);
        $agent->delete();
        return redirect()->route('agents.index')->with('success', 'Agent supprimé.');
    }
}
