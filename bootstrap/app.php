<?php

use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\EnsureUserIsAgent;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            Route::middleware('web')
                ->group(base_path('routes/commandes.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);
        $middleware->trustProxies(at: '*');
        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
            'agent' => EnsureUserIsAgent::class,
        ]);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->report(function (TokenMismatchException $exception) {
            $request = request();

            Log::warning('csrf_token_mismatch', [
                'path' => $request->path(),
                'method' => $request->method(),
                'host' => $request->getHost(),
                'origin' => $request->headers->get('origin'),
                'referer' => $request->headers->get('referer'),
                'ip' => $request->ip(),
                'has_session_cookie' => $request->hasCookie(config('session.cookie')),
                'has_xsrf_cookie' => $request->hasCookie('XSRF-TOKEN'),
                'has_x_csrf_token_header' => $request->headers->has('X-CSRF-TOKEN'),
                'has_x_xsrf_token_header' => $request->headers->has('X-XSRF-TOKEN'),
                'session_id_prefix' => substr((string) $request->session()->getId(), 0, 12),
            ]);
        });
    })->create();
