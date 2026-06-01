<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Support\TicketTimelineTemplateSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class TicketTimelineTemplateController extends Controller
{
    public function edit()
    {
        $user = Auth::user();
        $isAdmin = $user && $user->agent && $user->agent->is_admin;

        return Inertia::render('settings/ticket-timeline-templates', [
            'settings' => TicketTimelineTemplateSettings::load(),
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
            'templates' => ['required', 'array', 'min:1'],
            'templates.*.eventType' => ['required', 'string', 'max:60', 'distinct', 'regex:/^[a-z0-9_\-]{2,60}$/'],
            'templates.*.label' => ['required', 'string', 'max:80'],
            'templates.*.enabled' => ['required', 'boolean'],
            'templates.*.summary' => ['nullable', 'string', 'max:500'],
            'templates.*.details' => ['nullable', 'string', 'max:3000'],
        ]);

        TicketTimelineTemplateSettings::save($validated);

        return back()->with('success', 'Modeles de messages enregistres.');
    }
}
