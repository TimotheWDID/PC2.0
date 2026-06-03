<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        $user = $request->user() ? $request->user()->load('agent') : null;
        $canToggleNonAgentPreview = (bool) ($user?->agent?->is_admin);
        $nonAgentPreviewActive = $canToggleNonAgentPreview && (bool) $request->session()->get('preview_as_non_agent', false);
        $sharedUser = $user;

        if ($nonAgentPreviewActive && $user) {
            // Never mutate the authenticated user instance used by route middleware/authorization.
            $sharedUser = clone $user;
            $sharedUser->setRelation('agent', null);
        }

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth' => [
                // Ensure the user's agent relation is loaded so frontend can check is_admin
                'user' => $sharedUser,
            ],
            'preview' => [
                'nonAgent' => $nonAgentPreviewActive,
                'canToggle' => $canToggleNonAgentPreview,
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
