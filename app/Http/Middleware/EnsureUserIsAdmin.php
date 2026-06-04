<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class EnsureUserIsAdmin
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next)
    {
        if ($request->routeIs('preview.non-agent.toggle') || $request->routeIs('preview.mode.set')) {
            return $next($request);
        }

        $user = Auth::user();

        // Consider admin if either user has is_admin flag or related agent record is_admin
        $isAdmin = false;
        if ($user) {
            if (isset($user->is_admin) && $user->is_admin) {
                $isAdmin = true;
            }

            if (method_exists($user, 'agent') && $user->agent && isset($user->agent->is_admin) && $user->agent->is_admin) {
                $isAdmin = true;
            }
        }

        $sessionPreviewMode = $request->session()->get('preview_mode');
        $legacyNonAgentPreview = (bool) $request->session()->get('preview_as_non_agent', false);
        $isPreviewingAsNonAdmin = is_string($sessionPreviewMode)
            ? in_array($sessionPreviewMode, ['agent', 'user'], true)
            : $legacyNonAgentPreview;

        if ($isPreviewingAsNonAdmin) {
            $isAdmin = false;
        }

        if (! $isAdmin) {
            abort(403, 'Unauthorized. Admins only.');
        }

        return $next($request);
    }
}
