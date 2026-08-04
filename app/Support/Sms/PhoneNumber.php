<?php

namespace App\Support\Sms;

class PhoneNumber
{
    /**
     * Normalise un numéro de téléphone au format E.164 (ex. +33612345678).
     *
     * Retourne null si le numéro est invalide. Sans indicatif explicite,
     * les numéros nationaux (06..., 03...) reçoivent l'indicatif par défaut
     * configuré dans les réglages SMS (+33 par défaut).
     */
    public static function normalize(?string $raw, ?string $defaultCountryCode = null): ?string
    {
        $raw = trim((string) $raw);

        if ($raw === '') {
            return null;
        }

        $cleaned = preg_replace('/[\s.\-()\/]+/', '', $raw) ?? '';

        if (str_starts_with($cleaned, '00')) {
            $cleaned = '+' . substr($cleaned, 2);
        }

        if (str_starts_with($cleaned, '+')) {
            return preg_match('/^\+[1-9]\d{7,14}$/', $cleaned) === 1 ? $cleaned : null;
        }

        if (preg_match('/^\d+$/', $cleaned) !== 1) {
            return null;
        }

        $countryCode = trim((string) ($defaultCountryCode
            ?? SmsSettings::load()['default_country_code']
            ?? '+33'));

        if (preg_match('/^\+[1-9]\d{0,3}$/', $countryCode) !== 1) {
            return null;
        }

        if (str_starts_with($cleaned, '0')) {
            $cleaned = substr($cleaned, 1);
        }

        if ($cleaned === '' || str_starts_with($cleaned, '0')) {
            return null;
        }

        $candidate = $countryCode . $cleaned;

        return preg_match('/^\+[1-9]\d{7,14}$/', $candidate) === 1 ? $candidate : null;
    }
}
