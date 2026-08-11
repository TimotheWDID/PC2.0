<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class TicketCreatedNotificationSettings
{
    private const FILE = 'ticket_created_notification.json';

    public static function defaults(): array
    {
        return [
            'enabled' => true,
            'mail_subject' => 'Votre ticket #{ticket_id} a ete cree',
            'mail_body' => "Bonjour {client_name},\n\nVotre ticket #{ticket_id} a bien ete cree.\nTitre: {ticket_title}\n\nVous pouvez suivre votre ticket ici:\n{ticket_link}",
            'sms_body' => 'SupportPC: ticket #{ticket_id} cree ({ticket_title}). Suivi: {ticket_link} [signature]',
        ];
    }

    public static function load(): array
    {
        $defaults = self::defaults();
        $stored = [];

        if (Storage::disk('local')->exists(self::FILE)) {
            $raw = Storage::disk('local')->get(self::FILE);
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
            self::FILE,
            json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }
}
