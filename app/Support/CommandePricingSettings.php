<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class CommandePricingSettings
{
    public static function defaults(): array
    {
        return [
            'coefficient_marge' => 1.0,
        ];
    }

    public static function load(): array
    {
        $stored = [];

        if (Storage::disk('local')->exists('commande_pricing.json')) {
            $decoded = json_decode(Storage::disk('local')->get('commande_pricing.json'), true);

            if (is_array($decoded)) {
                $stored = $decoded;
            }
        }

        return array_merge(self::defaults(), $stored);
    }

    public static function save(array $settings): void
    {
        Storage::disk('local')->put(
            'commande_pricing.json',
            json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }
}