<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Support\Sms\PhoneNumber;
use App\Support\Sms\SmsComposer;
use App\Support\Sms\SmsFactorClient;
use App\Support\Sms\SmsSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class SmsDebugController extends Controller
{
    public function edit()
    {
        $this->ensureAdmin();

        return Inertia::render('settings/sms-debug', [
            'defaults' => $this->defaults(),
            'result' => null,
        ]);
    }

    public function send(Request $request, SmsFactorClient $client)
    {
        $this->ensureAdmin();

        $validated = $request->validate([
            'to' => ['required', 'string', 'max:30'],
            'message' => ['required', 'string', 'max:1000'],
            'sender' => ['nullable', 'string', 'max:20'],
            'base_url' => ['nullable', 'string', 'max:255'],
            'send_path' => ['nullable', 'string', 'max:255'],
            'api_key' => ['nullable', 'string', 'max:1000'],
            'auth_header' => ['nullable', 'string', 'max:100'],
            'auth_prefix' => ['nullable', 'string', 'max:50'],
            'verify_ssl' => ['nullable', 'boolean'],
            'with_decorations' => ['nullable', 'boolean'],
        ]);

        $settings = SmsSettings::load();
        $withDecorations = $request->boolean('with_decorations');

        $overrides = array_filter([
            'base_url' => $validated['base_url'] ?? null,
            'send_path' => $validated['send_path'] ?? null,
            'api_key' => trim((string) ($validated['api_key'] ?? '')) !== '' ? trim((string) $validated['api_key']) : null,
            'auth_header' => $validated['auth_header'] ?? null,
            'auth_prefix' => $validated['auth_prefix'] ?? null,
            'sender' => $validated['sender'] ?? null,
        ], static fn ($value) => $value !== null);
        $overrides['verify_ssl'] = $request->boolean('verify_ssl');

        $normalizedTo = PhoneNumber::normalize(
            $validated['to'],
            (string) ($settings['default_country_code'] ?? '+33')
        );

        $text = (new SmsComposer(array_merge($settings, $overrides)))
            ->compose($validated['message'], [], $withDecorations);

        $result = $client->send((string) $normalizedTo, $text, $validated['sender'] ?? null, $overrides);

        return Inertia::render('settings/sms-debug', [
            'defaults' => $this->defaults(),
            'result' => [
                'ok' => $result['ok'],
                'http_status' => $result['http_status'],
                'api_code' => $result['api_code'],
                'body' => $result['body'],
                'decoded' => $result['decoded'],
                'url' => $result['url'],
                'request' => $result['request'],
                'normalized_to' => $normalizedTo,
            ],
            'submitted' => [
                'to' => $validated['to'],
                'message' => $validated['message'],
                'sender' => $validated['sender'] ?? null,
                'base_url' => $validated['base_url'] ?? (string) ($settings['base_url'] ?? ''),
                'send_path' => $validated['send_path'] ?? (string) ($settings['send_path'] ?? ''),
                'auth_header' => $validated['auth_header'] ?? (string) ($settings['auth_header'] ?? ''),
                'auth_prefix' => $validated['auth_prefix'] ?? (string) ($settings['auth_prefix'] ?? ''),
                'verify_ssl' => $request->boolean('verify_ssl'),
                'with_decorations' => $withDecorations,
            ],
        ]);
    }

    private function ensureAdmin(): void
    {
        $user = Auth::user();

        if (! $user || ! ($user->agent?->is_admin)) {
            abort(403, 'Acces reserve aux administrateurs.');
        }
    }

    private function defaults(): array
    {
        $settings = SmsSettings::load();

        return [
            'to' => '',
            'message' => 'Test SMSFactor depuis SupportPC',
            'sender' => (string) ($settings['sender'] ?? config('app.name', 'SupportPC')),
            'base_url' => (string) ($settings['base_url'] ?? 'https://api.smsfactor.com'),
            'send_path' => (string) ($settings['send_path'] ?? '/send'),
            'api_key' => '',
            'api_key_set' => trim((string) ($settings['api_key'] ?? '')) !== '',
            'auth_header' => (string) ($settings['auth_header'] ?? 'X-API-KEY'),
            'auth_prefix' => (string) ($settings['auth_prefix'] ?? ''),
            'verify_ssl' => (bool) ($settings['verify_ssl'] ?? true),
            'with_decorations' => false,
        ];
    }
}
