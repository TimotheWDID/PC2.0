<?php

namespace App\Http\Middleware;

use App\Models\DiagAppToken;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Authenticates the PC2 Diag application by its bearer key, as the
 * technician who paired it. Only active agents keep access.
 */
class AuthenticateDiagApp
{
    public function handle(Request $request, Closure $next)
    {
        $plain = (string) $request->bearerToken();
        $token = $plain !== '' ? DiagAppToken::findByPlain($plain) : null;
        $user = $token?->user;

        if (! $token || ! $user) {
            return response()->json(['message' => 'Clé d\'accès invalide ou révoquée. Associez à nouveau l\'application depuis la page Diag rapide.'], 401);
        }

        if (! $user->agent || ! $user->agent->is_active) {
            return response()->json(['message' => 'Ce compte n\'est plus un technicien actif.'], 403);
        }

        Auth::setUser($user);
        $request->attributes->set('diag_app_token', $token);

        $token->forceFill([
            'last_used_at' => now(),
            'last_used_ip' => $request->ip(),
            'last_machine' => mb_substr((string) $request->header('X-Diag-Machine', $token->last_machine), 0, 255) ?: null,
        ])->save();

        return $next($request);
    }
}
