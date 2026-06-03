<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DeviceSessionController extends Controller
{
    public function edit(Request $request): Response
    {
        $currentSessionId = $request->session()->getId();
        $table = config('session.table', 'sessions');

        $sessions = DB::table($table)
            ->where('user_id', $request->user()->id)
            ->orderByDesc('last_activity')
            ->get(['id', 'ip_address', 'user_agent', 'last_activity'])
            ->map(function ($session) use ($currentSessionId) {
                $userAgent = (string) ($session->user_agent ?? '');

                return [
                    'id' => (string) $session->id,
                    'ip_address' => $session->ip_address ?: 'IP inconnue',
                    'user_agent' => $userAgent !== '' ? $userAgent : 'Navigateur inconnu',
                    'last_active_at' => Carbon::createFromTimestamp((int) $session->last_activity)->toISOString(),
                    'is_current_device' => $session->id === $currentSessionId,
                    'device_type' => $this->detectDeviceType($userAgent),
                ];
            })
            ->values();

        return Inertia::render('settings/device-sessions', [
            'sessions' => $sessions,
            'status' => $request->session()->get('status'),
        ]);
    }

    public function destroyOthers(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string', 'current_password'],
        ]);

        Auth::logoutOtherDevices($validated['password']);

        DB::table(config('session.table', 'sessions'))
            ->where('user_id', $request->user()->id)
            ->where('id', '!=', $request->session()->getId())
            ->delete();

        return back()->with('status', 'Tous les autres appareils ont ete deconnectes.');
    }

    private function detectDeviceType(string $userAgent): string
    {
        $ua = strtolower($userAgent);

        if ($ua === '') {
            return 'Inconnu';
        }

        if (str_contains($ua, 'tablet') || str_contains($ua, 'ipad')) {
            return 'Tablette';
        }

        if (str_contains($ua, 'mobile') || str_contains($ua, 'android') || str_contains($ua, 'iphone')) {
            return 'Mobile';
        }

        return 'Ordinateur';
    }
}
