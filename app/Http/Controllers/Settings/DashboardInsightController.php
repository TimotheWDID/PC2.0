<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Support\DashboardInsightSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class DashboardInsightController extends Controller
{
    public function edit()
    {
        $user = Auth::user();
        $isAdmin = $user && $user->agent && $user->agent->is_admin;

        return Inertia::render('settings/dashboard-insights', [
            'settings' => DashboardInsightSettings::load(),
            'defaults' => DashboardInsightSettings::defaults(),
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
            'ticket_pending_hours' => ['required', 'integer', 'min:1', 'max:720'],
            'ticket_low_info_hours' => ['required', 'integer', 'min:1', 'max:720'],
            'ticket_stalled_days' => ['required', 'integer', 'min:1', 'max:365'],
            'commande_incomplete_hours' => ['required', 'integer', 'min:1', 'max:720'],
            'commande_stalled_days' => ['required', 'integer', 'min:1', 'max:365'],
            'max_items_per_rule' => ['required', 'integer', 'min:1', 'max:20'],
            'recent_tickets_limit' => ['required', 'integer', 'min:1', 'max:50'],
        ]);

        DashboardInsightSettings::save($validated);

        return back()->with('success', 'Reglages dashboard enregistres.');
    }
}
