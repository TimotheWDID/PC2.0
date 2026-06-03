<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class PreviewModeController extends Controller
{
    public function toggleNonAgent(Request $request): RedirectResponse
    {
        $user = $request->user()?->load('agent');

        if (! $user || ! $user->agent || ! $user->agent->is_admin) {
            abort(403);
        }

        $currentlyActive = (bool) $request->session()->get('preview_as_non_agent', false);

        $request->session()->put('preview_as_non_agent', ! $currentlyActive);

        return back();
    }
}
