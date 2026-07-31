<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class SmsFactorySettings
{
    public static function defaults(): array
    {
        $footer = (string) config('services.smsfactory.footer', config('services.smsfactory.signature', ''));

        return [
            'enabled' => (bool) config('services.smsfactory.enabled', false),
            'base_url' => (string) config('services.smsfactory.base_url', 'https://api.smsfactor.com'),
            'send_path' => (string) config('services.smsfactory.send_path', '/send'),
            'max_length' => (int) config('services.smsfactory.max_length', 120),
            'api_key' => (string) config('services.smsfactory.api_key', ''),
            'auth_header' => (string) config('services.smsfactory.auth_header', 'X-API-KEY'),
            'auth_prefix' => (string) config('services.smsfactory.auth_prefix', ''),
            'sender' => (string) config('services.smsfactory.sender', config('app.name', 'SupportPC')),
            'header' => (string) config('services.smsfactory.header', ''),
            'footer' => $footer,
            'signature' => $footer,
            'templates' => self::defaultTemplates(),
        ];
    }

    public static function load(): array
    {
        $defaults = self::defaults();
        $stored = [];

        if (Storage::disk('local')->exists('sms_factory.json')) {
            $raw = Storage::disk('local')->get('sms_factory.json');
            $decoded = json_decode($raw, true);

            if (is_array($decoded)) {
                $stored = $decoded;
            }
        }

        $settings = array_replace_recursive($defaults, $stored);
        $settings['signature'] = (string) ($settings['footer'] ?? $settings['signature'] ?? '');

        return $settings;
    }

    public static function save(array $settings): void
    {
        Storage::disk('local')->put(
            'sms_factory.json',
            json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }

    private static function defaultTemplates(): array
    {
        return [
            [
                'title' => 'Relance standard',
                'content' => "Bonjour,\n\nNous avons bien pris en compte votre demande et nous revenons vers vous au plus vite.",
                'bypass_decorations' => false,
            ],
            [
                'title' => 'Message court',
                'content' => 'OK, merci pour votre retour.',
                'bypass_decorations' => true,
            ],
        ];
    }
}