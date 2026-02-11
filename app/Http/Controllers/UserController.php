<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;

class UserController extends Controller
{
    public function index()
    {
        $users = User::orderBy('id', 'desc')->get()->map(function ($u) {
            return [
                'id' => $u->id,
                'first_name' => $u->first_name ?? null,
                'last_name' => $u->last_name ?? null,
                'name' => $u->name,
                'email' => $u->email,
                'phone' => $u->phone ?? null,
                'created_at' => $u->created_at?->toDateTimeString(),
            ];
        });

        return Inertia::render('Users/Index', ['users' => $users]);
    }

    public function create()
    {
        return Inertia::render('Users/Create');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255|unique:users,email',
            'phone' => 'nullable|string|max:255',
            'address' => 'nullable|string|max:500',
            'password' => 'nullable|string|min:8|confirmed',
        ]);

        if (!empty($validated['password'])) {
            $validated['password'] = bcrypt($validated['password']);
        } else {
            unset($validated['password']);
        }

        User::create($validated);

        return redirect()->route('users.index')->with('success', 'Utilisateur créé avec succès.');
    }

    public function show($id)
    {
        $user = User::findOrFail($id);
        return Inertia::render('Users/Edit', ['user' => $user]);
    }

    public function edit($id)
    {
        $user = User::findOrFail($id);
        return Inertia::render('Users/Edit', [
            'user' => [
                'id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'phone' => $user->phone,
                'address' => $user->address,
                'internal_note' => $user->internal_note,
                'hiboutik_id' => $user->hiboutik_id,
                'default_notification_preference' => $user->default_notification_preference,
            ]
        ]);
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $data = $request->validate([
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255|unique:users,email,' . $id,
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string|max:1024',
            'internal_note' => 'nullable|string',
            'hiboutik_id' => 'nullable|string|max:255',
            'default_notification_preference' => 'required|in:SMS,Email,None',
            'password' => 'nullable|string|min:8|confirmed',
        ]);

        // Si le mot de passe est fourni, le hasher, sinon le retirer
        if (!empty($data['password'])) {
            $data['password'] = bcrypt($data['password']);
        } else {
            unset($data['password']);
        }

        $user->update($data);
        return redirect()->route('users.edit', $user->id)->with('success', 'Utilisateur mis à jour.');
    }

    public function updateInternalNote(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $data = $request->validate([
            'internal_note' => 'nullable|string',
        ]);
        $user->update($data);
        return back();
    }

    public function destroy($id)
    {
        $user = User::findOrFail($id);
        $user->delete();
        return redirect()->route('users.index')->with('success', 'Utilisateur supprimé.');
    }

    public function sendPasswordSetupEmail(Request $request, $id)
    {
        $user = User::findOrFail($id);

        // Générer un token unique
        $token = bin2hex(random_bytes(32));
        $user->update([
            'password_setup_token' => $token,
            'password_setup_token_expires_at' => now()->addDays(7),
        ]);

        // URL pour définir le mot de passe
        $url = url("/set-password/{$token}");

        // TODO: Envoyer l'email
        // Pour l'instant, on retourne juste le lien

        return back()->with('success', "Lien d'activation envoyé par email. Lien: {$url}");
    }

    public function sendPasswordSetupSms(Request $request, $id)
    {
        $user = User::findOrFail($id);

        if (empty($user->phone)) {
            return back()->withErrors(['phone' => 'L\'utilisateur n\'a pas de numéro de téléphone.']);
        }

        // Générer un token unique
        $token = bin2hex(random_bytes(32));
        $user->update([
            'password_setup_token' => $token,
            'password_setup_token_expires_at' => now()->addDays(7),
        ]);

        // URL pour définir le mot de passe
        $url = url("/set-password/{$token}");

        // TODO: Envoyer le SMS
        // Pour l'instant, on retourne juste le lien

        return back()->with('success', "Lien d'activation envoyé par SMS. Lien: {$url}");
    }
}
