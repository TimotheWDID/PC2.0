<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Support\SmsFactorySettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class SmsSettingsController extends Controller
{
    public function edit()
    {
        $user = Auth::user();
        $isAdmin = $user && $user->agent && $user->agent->is_admin;

        return Inertia::render('settings/sms', [
            'settings' => SmsFactorySettings::load(),
            'defaults' => SmsFactorySettings::defaults(),
            'canManage' => $isAdmin,
        ]);
    }

    public function update(Request $request)
    {
        $user = Auth::user();
        $isAdmin = $user && $user->agent && $user->agent->is_admin;

        if (! $isAdmin) {
            abort(403, 'Acces reserve aux administrateurs.');
        }

        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'base_url' => ['required', 'string', 'max:255'],
            'send_path' => ['required', 'string', 'max:255'],
            'max_length' => ['required', 'integer', 'min:1', 'max:1000'],
            'api_key' => ['nullable', 'string', 'max:1000'],
            'auth_header' => ['required', 'string', 'max:100'],
            'auth_prefix' => ['nullable', 'string', 'max:50'],
            'sender' => ['required', 'string', 'max:20'],
            'header' => ['nullable', 'string', 'max:1000'],
            'footer' => ['nullable', 'string', 'max:1000'],
            'templates' => ['nullable', 'array'],
            'templates.*.title' => ['required_with:templates', 'string', 'max:120'],
            'templates.*.content' => ['required_with:templates', 'string', 'max:1000'],
            'templates.*.bypass_decorations' => ['required_with:templates', 'boolean'],
        ]);

        $settings = array_merge(SmsFactorySettings::defaults(), $validated);
        $settings['footer'] = (string) ($validated['footer'] ?? '');
        $settings['signature'] = $settings['footer'];
        $settings['templates'] = array_values(array_map(static function (array $template): array {
            return [
                'title' => trim((string) ($template['title'] ?? '')),
                'content' => (string) ($template['content'] ?? ''),
                'bypass_decorations' => (bool) ($template['bypass_decorations'] ?? false),
            ];
        }, $validated['templates'] ?? []));

        SmsFactorySettings::save($settings);

        return back()->with('success', 'Parametres SMS enregistres.');
    }
}