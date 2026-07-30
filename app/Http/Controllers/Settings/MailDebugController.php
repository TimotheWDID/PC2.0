<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Mail\MailDebugMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;

class MailDebugController extends Controller
{
    public function edit()
    {
        $this->ensureAdmin();

        return Inertia::render('settings/mail-debug', [
            'defaults' => $this->defaults(),
            'result' => null,
        ]);
    }

    public function send(Request $request)
    {
        $this->ensureAdmin();

        $validated = $request->validate([
            'to' => ['required', 'email', 'max:255'],
            'subject' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:5000'],
            'from_address' => ['nullable', 'email', 'max:255'],
            'from_name' => ['nullable', 'string', 'max:255'],
            'reply_to' => ['nullable', 'email', 'max:255'],
            'as_html' => ['nullable', 'boolean'],
        ]);

        $mailerName = (string) config('mail.default', 'smtp');

        try {
            Mail::mailer($mailerName)->to($validated['to'])->send(
                new MailDebugMessage(
                    subjectLine: $validated['subject'],
                    messageBody: $validated['message'],
                    asHtml: $request->boolean('as_html'),
                    fromAddress: $validated['from_address'] ?? null,
                    fromName: $validated['from_name'] ?? null,
                    replyToAddress: $validated['reply_to'] ?? null,
                )
            );

            $result = [
                'ok' => true,
                'mailer' => $mailerName,
                'to' => $validated['to'],
                'subject' => $validated['subject'],
                'from_address' => $validated['from_address'] ?? config('mail.from.address'),
                'from_name' => $validated['from_name'] ?? config('mail.from.name'),
                'reply_to' => $validated['reply_to'] ?? null,
                'as_html' => $request->boolean('as_html'),
                'message' => 'Mail de test envoye.',
                'error' => null,
            ];
        } catch (\Throwable $exception) {
            $result = [
                'ok' => false,
                'mailer' => $mailerName,
                'to' => $validated['to'],
                'subject' => $validated['subject'],
                'from_address' => $validated['from_address'] ?? config('mail.from.address'),
                'from_name' => $validated['from_name'] ?? config('mail.from.name'),
                'reply_to' => $validated['reply_to'] ?? null,
                'as_html' => $request->boolean('as_html'),
                'message' => 'Envoi echoue.',
                'error' => $exception->getMessage(),
            ];
        }

        return Inertia::render('settings/mail-debug', [
            'defaults' => $this->defaults(),
            'result' => $result,
            'submitted' => [
                'to' => $validated['to'],
                'subject' => $validated['subject'],
                'message' => $validated['message'],
                'from_address' => $validated['from_address'] ?? null,
                'from_name' => $validated['from_name'] ?? null,
                'reply_to' => $validated['reply_to'] ?? null,
                'as_html' => $request->boolean('as_html'),
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
            'subject' => 'Test mail SupportPC',
            'message' => "Bonjour,\n\nCeci est un mail de test depuis SupportPC.\n",
            'from_address' => (string) config('mail.from.address', 'hello@example.com'),
            'from_name' => (string) config('mail.from.name', config('app.name', 'SupportPC')),
            'reply_to' => (string) config('mail.from.address', 'hello@example.com'),
            'as_html' => true,
            'mailer' => (string) config('mail.default', 'smtp'),
        ];
    }
}
