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
        $sessionPreviewMode = $request->session()->get('preview_mode');
        $legacyNonAgentPreview = (bool) $request->session()->get('preview_as_non_agent', false);
        $previewMode = is_string($sessionPreviewMode) && in_array($sessionPreviewMode, ['admin', 'agent', 'user'], true)
            ? $sessionPreviewMode
            : ($legacyNonAgentPreview ? 'user' : ($canToggleNonAgentPreview ? 'admin' : ($user?->agent ? 'agent' : 'user')));
        $previewMode = $canToggleNonAgentPreview ? $previewMode : ($user?->agent ? 'agent' : 'user');
        $nonAgentPreviewActive = $previewMode === 'user';
        $sharedUser = $user;

        if ($user && $canToggleNonAgentPreview) {
            // Never mutate the authenticated user instance used by route middleware/authorization.
            $sharedUser = clone $user;

            if ($previewMode === 'user') {
                $sharedUser->setRelation('agent', null);
            } elseif ($previewMode === 'agent') {
                if ($sharedUser->relationLoaded('agent') && $sharedUser->agent) {
                    $sharedAgent = clone $sharedUser->agent;
                    $sharedAgent->is_admin = false;
                    $sharedUser->setRelation('agent', $sharedAgent);
                }

                if (isset($sharedUser->is_admin)) {
                    $sharedUser->is_admin = false;
                }
            }
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
                'mode' => $previewMode,
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
