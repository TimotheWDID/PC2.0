<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Support\TicketLabelSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class TicketLabelController extends Controller
{
    public function edit()
    {
        $user = Auth::user();
        $isAdmin = $user && $user->agent && $user->agent->is_admin;

        return Inertia::render('settings/ticket-label', [
            'settings' => TicketLabelSettings::load(),
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
            'widthMm' => 'required|numeric|min:1|max:120',
            'heightMm' => 'required|numeric|min:20|max:80',
            'qrSizeMm' => 'required|numeric|min:10|max:40',
            'marginMm' => 'required|numeric|min:0|max:5',
            'layout' => 'required|in:qr-right,qr-left',
            'showId' => 'required|boolean',
            'showClient' => 'required|boolean',
            'showTitle' => 'required|boolean',
            'showMessage' => 'required|boolean',
            'showCategory' => 'required|boolean',
            'showPriority' => 'required|boolean',
            'showStatus' => 'required|boolean',
            'showEmail' => 'required|boolean',
            'showPhone' => 'required|boolean',
            'showAddress' => 'required|boolean',
            'showDate' => 'required|boolean',
            'showTime' => 'required|boolean',
            'showQr' => 'required|boolean',
        ]);

        TicketLabelSettings::save($validated);

        return back()->with('success', 'Parametres enregistres.');
    }
}
