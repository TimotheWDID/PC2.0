<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountIsActive
{
    /**
     * Ends the session of a technician disabled while logged in.
     * The Diag app has its own check in AuthenticateDiagApp.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->isDisabledAgent()) {
            return $next($request);
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
