<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    /**
     * Show the registration page.
     */
    public function create(): Response
    {
        return Inertia::render('auth/register');
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => 'nullable|string|email|max:255|unique:'.User::class,
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string|max:1024',
            'postal_code' => 'nullable|string|max:20',
            'city' => 'nullable|string|max:255',
                'first_name' => 'nullable|string|max:255',
                'last_name' => 'nullable|string|max:255',
                'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        // Concatenate address parts into a single `address` string so we don't
        // require separate `postal_code` / `city` columns in the users table.
        $addressParts = array_filter([
            $request->address ?? null,
            $request->postal_code ?? null,
            $request->city ?? null,
        ], fn ($v) => !is_null($v) && $v !== '');

        $fullAddress = $addressParts ? implode(', ', $addressParts) : null;

        $user = User::create([
            'first_name' => $request->first_name,
            'last_name' => $request->last_name,
            'email' => $request->email ?? null,
            'phone' => $request->phone ?? null,
            'address' => $fullAddress,
            'password' => $request->password,
        ]);

        event(new Registered($user));

        Auth::login($user);

        $request->session()->regenerate();

        return redirect()->intended(route('dashboard', absolute: false));
    }
}
