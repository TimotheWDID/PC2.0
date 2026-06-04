<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class PreviewModeController extends Controller
{
    private function currentPreviewMode(Request $request): string
    {
        $mode = $request->session()->get('preview_mode');

        if (is_string($mode) && in_array($mode, ['admin', 'agent', 'user'], true)) {
            return $mode;
        }

        $legacyNonAgent = (bool) $request->session()->get('preview_as_non_agent', false);

        return $legacyNonAgent ? 'user' : 'admin';
    }

    private function persistPreviewMode(Request $request, string $mode): void
    {
        $request->session()->put('preview_mode', $mode);
        // Keep legacy flag in sync for compatibility with existing sessions.
        $request->session()->put('preview_as_non_agent', $mode === 'user');
    }

    private function ensureAdmin(Request $request): void
    {
        $user = $request->user()?->load('agent');

        if (! $user || ! $user->agent || ! $user->agent->is_admin) {
            abort(403);
        }
    }

    public function toggleNonAgent(Request $request): RedirectResponse
    {
        $this->ensureAdmin($request);

        $currentMode = $this->currentPreviewMode($request);
        $nextMode = $currentMode === 'user' ? 'admin' : 'user';

        $this->persistPreviewMode($request, $nextMode);

        return back();
    }

    public function setMode(Request $request): RedirectResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'mode' => ['required', 'in:admin,agent,user'],
        ]);

        $this->persistPreviewMode($request, $validated['mode']);

        return back();
    }
}
