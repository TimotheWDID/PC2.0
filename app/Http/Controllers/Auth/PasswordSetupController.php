<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;

class PasswordSetupController extends Controller
{
    /**
     * Display the password setup form.
     */
    public function create(string $token)
    {
        $user = User::where('password_setup_token', $token)
            ->where('password_setup_token_expires_at', '>', now())
            ->first();

        if (!$user) {
            return redirect('/login')->with('error', 'Ce lien de configuration est invalide ou a expiré.');
        }

        return Inertia::render('Auth/SetPassword', [
            'token' => $token,
            'email' => $user->email,
        ]);
    }

    /**
     * Handle password setup.
     */
    public function store(Request $request)
    {
        $request->validate([
            'token' => ['required', 'string'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $user = User::where('password_setup_token', $request->token)
            ->where('password_setup_token_expires_at', '>', now())
            ->first();

        if (!$user) {
            return back()->withErrors(['token' => 'Ce lien de configuration est invalide ou a expiré.']);
        }

        $user->update([
            'password' => Hash::make($request->password),
            'password_setup_token' => null,
            'password_setup_token_expires_at' => null,
        ]);

        return redirect('/login')->with('success', 'Votre mot de passe a été défini avec succès. Vous pouvez maintenant vous connecter.');
    }
}
