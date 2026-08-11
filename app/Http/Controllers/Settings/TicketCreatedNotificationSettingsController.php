<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Support\TicketCreatedNotificationSettings;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TicketCreatedNotificationSettingsController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('settings/ticket-created-notification', [
            'settings' => TicketCreatedNotificationSettings::load(),
            'placeholders' => [
                '{ticket_id}',
                '{ticket_title}',
                '{client_name}',
                '{ticket_link}',
                '{app_name}',
            ],
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'mail_subject' => ['required', 'string', 'max:255'],
            'mail_body' => ['required', 'string', 'max:5000'],
            'sms_body' => ['required', 'string', 'max:1000'],
        ]);

        TicketCreatedNotificationSettings::save([
            'enabled' => (bool) $validated['enabled'],
            'mail_subject' => trim((string) $validated['mail_subject']),
            'mail_body' => trim((string) $validated['mail_body']),
            'sms_body' => trim((string) $validated['sms_body']),
        ]);

        return back()->with('success', 'Parametres de notification a la creation enregistres.');
    }
}
