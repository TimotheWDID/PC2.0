<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Support\SmsFactoryClient;
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

    public function send(Request $request, SmsFactoryClient $client)
    {
        $this->ensureAdmin();

        $validated = $request->validate([
            'to' => ['required', 'string', 'max:30'],
            'message' => ['required', 'string', 'max:500'],
            'sender' => ['nullable', 'string', 'max:20'],
            'base_url' => ['nullable', 'string', 'max:255'],
            'send_path' => ['nullable', 'string', 'max:255'],
            'api_key' => ['nullable', 'string', 'max:1000'],
            'auth_header' => ['nullable', 'string', 'max:100'],
            'auth_prefix' => ['nullable', 'string', 'max:50'],
            'verify_ssl' => ['nullable', 'boolean'],
        ]);

        $result = $client->sendDetailed(
            $validated['to'],
            $validated['message'],
            $validated['sender'] ?? null,
            [
                'base_url' => $validated['base_url'] ?? config('services.smsfactory.base_url'),
                'send_path' => $validated['send_path'] ?? config('services.smsfactory.send_path'),
                'api_key' => $validated['api_key'] ?? config('services.smsfactory.api_key'),
                'auth_header' => $validated['auth_header'] ?? config('services.smsfactory.auth_header'),
                'auth_prefix' => $validated['auth_prefix'] ?? config('services.smsfactory.auth_prefix'),
                'verify_ssl' => $request->boolean('verify_ssl'),
                'sender' => $validated['sender'] ?? config('services.smsfactory.sender'),
            ]
        );

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
            ],
            'submitted' => [
                'to' => $validated['to'],
                'message' => $validated['message'],
                'sender' => $validated['sender'] ?? null,
                'base_url' => $validated['base_url'] ?? config('services.smsfactory.base_url'),
                'send_path' => $validated['send_path'] ?? config('services.smsfactory.send_path'),
                'auth_header' => $validated['auth_header'] ?? config('services.smsfactory.auth_header'),
                'auth_prefix' => $validated['auth_prefix'] ?? config('services.smsfactory.auth_prefix'),
                'verify_ssl' => $request->boolean('verify_ssl'),
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
        return [
            'to' => '',
            'message' => 'Test SMSFactor depuis SupportPC',
            'sender' => (string) config('services.smsfactory.sender', config('app.name', 'SupportPC')),
            'base_url' => (string) config('services.smsfactory.base_url', 'https://api.smsfactor.com'),
            'send_path' => (string) config('services.smsfactory.send_path', '/send'),
            'api_key' => (string) config('services.smsfactory.api_key', ''),
            'auth_header' => (string) config('services.smsfactory.auth_header', 'Authorization'),
            'auth_prefix' => (string) config('services.smsfactory.auth_prefix', 'Bearer'),
            'verify_ssl' => (bool) config('services.smsfactory.verify_ssl', true),
        ];
    }
}
