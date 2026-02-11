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

        if (! $isAdmin) {
            abort(403, 'Unauthorized. Admins only.');
        }

        return $next($request);
    }
}
