<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class MailFooterSettings
{
    public static function defaults(): array
    {
        return [
            'enabled' => true,
            'content' => "Cordialement,\nSupportPC",
            'image_url' => '',
            'image_alt' => 'Logo SupportPC',
        ];
    }

    public static function load(): array
    {
        $defaults = self::defaults();
        $stored = [];

        if (Storage::disk('local')->exists('mail_footer.json')) {
            $raw = Storage::disk('local')->get('mail_footer.json');
            $decoded = json_decode($raw, true);

            if (is_array($decoded)) {
                $stored = $decoded;
            }
        }

        return array_replace_recursive($defaults, $stored);
    }

    public static function save(array $settings): void
    {
        Storage::disk('local')->put(
            'mail_footer.json',
            json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }
}
