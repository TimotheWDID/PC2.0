<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class TicketLabelSettings
{
    public static function defaults(): array
    {
        return config('ticket_label', []);
    }

    public static function load(): array
    {
        $defaults = self::defaults();
        $stored = [];

        if (Storage::disk('local')->exists('ticket_label.json')) {
            $raw = Storage::disk('local')->get('ticket_label.json');
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $stored = $decoded;
            }
        }

        return array_merge($defaults, $stored);
    }

    public static function save(array $settings): void
    {
        Storage::disk('local')->put(
            'ticket_label.json',
            json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }
}
