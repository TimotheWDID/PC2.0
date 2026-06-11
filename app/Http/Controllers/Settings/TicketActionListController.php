<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Support\TicketActionListSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class TicketActionListController extends Controller
{
    public function edit()
    {
        $user = Auth::user();
        $isAdmin = $user && $user->agent && $user->agent->is_admin;

        return Inertia::render('settings/ticket-action-lists', [
            'settings' => TicketActionListSettings::load(),
            'canManage' => $isAdmin,
        ]);
    }

    public function update(Request $request)
    {
        $user = Auth::user();
        $isAdmin = $user && $user->agent && $user->agent->is_admin;

        if (!$isAdmin) {
            abort(403, 'Acces reserve aux administrateurs.');
        }

        $validated = $request->validate([
            'lists' => ['required', 'array', 'min:1'],
            'lists.*.key' => ['required', 'string', 'max:60', 'distinct', 'regex:/^[a-z0-9_\-]{2,60}$/'],
            'lists.*.label' => ['required', 'string', 'max:80'],
            'lists.*.tasks' => ['required', 'array', 'min:1', 'max:30'],
            'lists.*.tasks.*' => ['required_with:lists.*.tasks', 'string', 'max:160'],
        ]);

        TicketActionListSettings::save($validated);

        return back()->with('success', 'Listes d\'actions predefinies enregistrees.');
    }
}
