<?php

namespace App\Support\Sms;

use Illuminate\Support\Facades\Storage;

class SmsSettings
{
    public const MIN_LENGTH = 10;

    public const MAX_LENGTH = 1000;

    public const DEFAULT_LENGTH = 160;

    private const FILE = 'sms_factory.json';

    public static function defaults(): array
    {
        return [
            'enabled' => (bool) config('services.smsfactory.enabled', false),
            'base_url' => (string) config('services.smsfactory.base_url', 'https://api.smsfactor.com'),
            'send_path' => (string) config('services.smsfactory.send_path', '/send'),
            'max_length' => (int) config('services.smsfactory.max_length', self::DEFAULT_LENGTH),
            'api_key' => (string) config('services.smsfactory.api_key', ''),
            'auth_header' => (string) config('services.smsfactory.auth_header', 'X-API-KEY'),
            'auth_prefix' => (string) config('services.smsfactory.auth_prefix', ''),
            'sender' => (string) config('services.smsfactory.sender', config('app.name', 'SupportPC')),
            'header' => (string) config('services.smsfactory.header', ''),
            'footer' => (string) config('services.smsfactory.footer', ''),
            'default_country_code' => (string) config('services.smsfactory.default_country_code', '+33'),
            'timeout' => (float) config('services.smsfactory.timeout', 10),
            'verify_ssl' => (bool) config('services.smsfactory.verify_ssl', true),
            'templates' => self::defaultTemplates(),
        ];
    }

    public static function load(): array
    {
        $stored = [];

        if (Storage::disk('local')->exists(self::FILE)) {
            $decoded = json_decode((string) Storage::disk('local')->get(self::FILE), true);

            if (is_array($decoded)) {
                $stored = $decoded;
            }
        }

        // Migration des anciens fichiers : la clé `signature` (dupliquée) alimente `footer`.
        if (trim((string) ($stored['footer'] ?? '')) === '' && trim((string) ($stored['signature'] ?? '')) !== '') {
            $stored['footer'] = (string) $stored['signature'];
        }
        unset($stored['signature']);

        $settings = array_replace_recursive(self::defaults(), $stored);

        // Les templates sauvegardés remplacent intégralement ceux par défaut
        // (array_replace_recursive fusionnerait les listes index par index).
        if (array_key_exists('templates', $stored) && is_array($stored['templates'])) {
            $settings['templates'] = array_values($stored['templates']);
        }

        return $settings;
    }

    public static function save(array $settings): void
    {
        unset($settings['signature']);

        Storage::disk('local')->put(
            self::FILE,
            json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }

    /**
     * Réponse unique à « le canal SMS est-il disponible ? » — utilisée par la
     * notification, le client HTTP et les contrôleurs.
     */
    public static function isEnabled(?array $settings = null): bool
    {
        $settings ??= self::load();

        return (bool) ($settings['enabled'] ?? false)
            && trim((string) ($settings['api_key'] ?? '')) !== '';
    }

    private static function defaultTemplates(): array
    {
        return [
            [
                'title' => 'Relance standard',
                'content' => "Bonjour,\n\nNous avons bien pris en compte votre demande et nous revenons vers vous au plus vite.",
            ],
            [
                'title' => 'Message court',
                'content' => 'OK, merci pour votre retour.',
            ],
        ];
    }
}
