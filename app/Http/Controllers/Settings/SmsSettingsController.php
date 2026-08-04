<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Support\Sms\SmsSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class SmsSettingsController extends Controller
{
    public function edit()
    {
        return Inertia::render('settings/sms', [
            'settings' => $this->settingsForFrontend(),
            'defaults' => $this->defaultsForFrontend(),
            'limits' => $this->limits(),
            'canManage' => $this->isAdmin(),
        ]);
    }

    public function templates()
    {
        return Inertia::render('settings/sms-templates', [
            'settings' => $this->settingsForFrontend(),
            'limits' => $this->limits(),
            'canManage' => $this->isAdmin(),
        ]);
    }

    public function update(Request $request)
    {
        if (! $this->isAdmin()) {
            abort(403, 'Acces reserve aux administrateurs.');
        }

        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'base_url' => ['required', 'string', 'max:255'],
            'send_path' => ['required', 'string', 'max:255'],
            'max_length' => ['required', 'integer', 'min:' . SmsSettings::MIN_LENGTH, 'max:' . SmsSettings::MAX_LENGTH],
            'api_key' => ['nullable', 'string', 'max:1000'],
            'auth_header' => ['required', 'string', 'max:100'],
            'auth_prefix' => ['nullable', 'string', 'max:50'],
            'sender' => ['required', 'string', 'max:20'],
            'header' => ['nullable', 'string', 'max:1000'],
            'footer' => ['nullable', 'string', 'max:1000'],
            'default_country_code' => ['required', 'string', 'regex:/^\+[1-9]\d{0,3}$/'],
            'timeout' => ['required', 'numeric', 'min:1', 'max:60'],
            'verify_ssl' => ['required', 'boolean'],
            'templates' => ['nullable', 'array'],
            'templates.*.title' => ['required_with:templates', 'string', 'max:120'],
            'templates.*.content' => ['required_with:templates', 'string', 'max:' . SmsSettings::MAX_LENGTH],
        ]);

        $current = SmsSettings::load();
        $settings = array_merge($current, $validated);

        // Une clé soumise vide signifie « conserver la clé actuelle » :
        // le frontend ne reçoit jamais la clé en clair.
        $settings['api_key'] = trim((string) ($validated['api_key'] ?? '')) !== ''
            ? trim((string) $validated['api_key'])
            : (string) ($current['api_key'] ?? '');

        $settings['header'] = (string) ($validated['header'] ?? '');
        $settings['footer'] = (string) ($validated['footer'] ?? '');
        $settings['templates'] = array_values(array_map(static function (array $template): array {
            return [
                'title' => trim((string) ($template['title'] ?? '')),
                'content' => (string) ($template['content'] ?? ''),
            ];
        }, $validated['templates'] ?? []));

        SmsSettings::save($settings);

        return back()->with('success', 'Parametres SMS enregistres.');
    }

    /**
     * Sauvegarde des templates seuls (page « Messages prédéfinis »), sans
     * toucher au reste de la configuration.
     */
    public function updateTemplates(Request $request)
    {
        if (! $this->isAdmin()) {
            abort(403, 'Acces reserve aux administrateurs.');
        }

        $validated = $request->validate([
            'templates' => ['present', 'array'],
            'templates.*.title' => ['required', 'string', 'max:120'],
            'templates.*.content' => ['required', 'string', 'max:' . SmsSettings::MAX_LENGTH],
        ]);

        $settings = SmsSettings::load();
        $settings['templates'] = array_values(array_map(static function (array $template): array {
            return [
                'title' => trim((string) ($template['title'] ?? '')),
                'content' => (string) ($template['content'] ?? ''),
            ];
        }, $validated['templates']));

        SmsSettings::save($settings);

        return back()->with('success', 'Messages predefinis enregistres.');
    }

    private function settingsForFrontend(): array
    {
        $settings = SmsSettings::load();
        $settings['api_key_set'] = trim((string) ($settings['api_key'] ?? '')) !== '';
        $settings['api_key'] = '';

        return $settings;
    }

    private function defaultsForFrontend(): array
    {
        $defaults = SmsSettings::defaults();
        $defaults['api_key_set'] = false;
        $defaults['api_key'] = '';

        return $defaults;
    }

    private function limits(): array
    {
        return [
            'max_length_min' => SmsSettings::MIN_LENGTH,
            'max_length_max' => SmsSettings::MAX_LENGTH,
        ];
    }

    private function isAdmin(): bool
    {
        $user = Auth::user();

        return (bool) ($user && $user->agent && $user->agent->is_admin);
    }
}
