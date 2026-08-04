<?php

use App\Models\Message;
use App\Models\Ticket;
use App\Notifications\Channels\SmsFactoryChannel;
use App\Notifications\TicketMessageNotification;
use App\Support\Sms\SmsFactorClient;
use App\Support\Sms\SmsSettings;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

function makeSmsTicket(array $attributes = []): Ticket
{
    $ticket = new Ticket();
    $ticket->forceFill(array_merge([
        'id' => 12,
        'title' => 'Problème d’écran',
        'notify_by' => 'SMS',
        'contact_phone' => '0611223344',
        'ticket_kind' => 'standard',
    ], $attributes));

    return $ticket;
}

function makeSmsMessage(string $content = 'Je vous réponds rapidement.'): Message
{
    $message = new Message();
    $message->forceFill(['content' => $content]);

    return $message;
}

function smsNotifiable(string $phone = '0611223344'): object
{
    return new class($phone) {
        public function __construct(public string $phone)
        {
        }
    };
}

it('uses the selected predefined SMS template when provided', function () {
    Storage::fake('local');
    SmsSettings::save([
        'enabled' => true,
        'api_key' => 'demo-key',
        'header' => '',
        'footer' => 'Signature',
        'templates' => [[
            'id' => 'welcome',
            'title' => 'Bienvenue',
            'content' => 'Bonjour, voici votre réponse.',
        ]],
    ]);

    $notification = new TicketMessageNotification(makeSmsTicket(), makeSmsMessage(), 'https://example.test/reply', [
        'template' => [
            'id' => 'welcome',
            'title' => 'Bienvenue',
            'content' => 'Bonjour, voici votre réponse.',
        ],
    ]);

    $sms = $notification->toSmsFactory(smsNotifiable());

    expect($sms)->not->toBeNull()
        ->and($sms->content)->toBe('Bonjour, voici votre réponse.')
        ->and($sms->recipient)->toBe('+33611223344');
});

it('builds a single fallback SMS message for non-predefined replies', function () {
    Storage::fake('local');
    SmsSettings::save([
        'enabled' => true,
        'api_key' => 'demo-key',
        'header' => '',
        'footer' => 'Signature',
        'templates' => [],
    ]);

    $notification = new TicketMessageNotification(
        makeSmsTicket(['id' => 34, 'contact_phone' => '0699887766']),
        makeSmsMessage(),
        'https://example.test/reply'
    );

    $sms = $notification->toSmsFactory(smsNotifiable('0699887766'));

    expect($sms)->not->toBeNull()
        ->and($sms->content)->toContain('Vous avez un nouveau message concernant votre demande')
        ->and($sms->content)->toContain('https://example.test/reply')
        ->and($sms->content)->toContain('Signature');
});

it('renders signature and magic link placeholders in any casing', function () {
    Storage::fake('local');
    SmsSettings::save([
        'enabled' => true,
        'api_key' => 'demo-key',
        'footer' => 'Planete-Computers',
        'templates' => [],
    ]);

    $notification = new TicketMessageNotification(makeSmsTicket(), makeSmsMessage(), 'https://example.test/r', [
        'template' => [
            'id' => 't',
            'title' => 'T',
            'content' => 'Suivi: [MAGICLINK] — [Signature]',
        ],
    ]);

    $sms = $notification->toSmsFactory(smsNotifiable());

    expect($sms->content)->toBe('Suivi: https://example.test/r — Planete-Computers');
});

it('keeps the full magic link within the character limit for the default fallback', function () {
    Storage::fake('local');
    SmsSettings::save([
        'enabled' => true,
        'api_key' => 'demo-key',
        'header' => '',
        'footer' => '03.89.82.76.33',
        'max_length' => 160,
        'templates' => [],
    ]);

    Http::fake([
        '*' => Http::response(['ok' => true], 200),
    ]);

    $link = 'https://example.test/tickets/1234567890/abc?token=0123456789abcdef';
    $notification = new TicketMessageNotification(makeSmsTicket(['id' => 77]), makeSmsMessage(str_repeat('Long. ', 40)), $link);
    $sms = $notification->toSmsFactory(smsNotifiable());

    app(SmsFactorClient::class)->send($sms->recipient, $sms->content);

    Http::assertSent(function ($request) use ($link) {
        $text = (string) data_get($request->data(), 'sms.message.text');
        $recipient = (string) data_get($request->data(), 'sms.recipients.gsm.0.value');

        return mb_strlen($text) <= 160
            && str_contains($text, $link)
            && $recipient === '+33611223344';
    });
});

it('truncates long predefined template content while preserving the full magic link and signature', function () {
    Storage::fake('local');
    SmsSettings::save([
        'enabled' => true,
        'api_key' => 'demo-key',
        'header' => '',
        'footer' => '03.89.82.76.33',
        'max_length' => 160,
        'templates' => [],
    ]);

    $link = 'https://example.test/tickets/1234567890/abc?token=0123456789abcdef';
    $notification = new TicketMessageNotification(makeSmsTicket(['id' => 99]), makeSmsMessage('Contenu'), $link, [
        'template' => [
            'id' => 'long-template',
            'title' => 'Long',
            'content' => 'Bonjour, nous avons bien pris en compte votre demande et nous revenons vers vous très rapidement concernant votre demande sur votre ticket en cours et aussi vous pouvez suivre l’avancement ici : ' . $link,
        ],
    ]);

    $sms = $notification->toSmsFactory(smsNotifiable());

    expect($sms)->not->toBeNull()
        ->and(mb_strlen($sms->content))->toBeLessThanOrEqual(160)
        ->and($sms->content)->toContain($link)
        ->and($sms->content)->toContain('03.89.82.76.33');
});

it('does not use the SMS channel when the stored settings disable it, even if the env config enables it', function () {
    Storage::fake('local');
    config()->set('services.smsfactory.enabled', true);
    config()->set('services.smsfactory.api_key', 'env-key');

    SmsSettings::save(['enabled' => false, 'api_key' => 'stored-key']);

    $notification = new TicketMessageNotification(makeSmsTicket(), makeSmsMessage(), 'https://example.test/r');

    expect($notification->via(smsNotifiable()))->toBe([]);
});

it('uses the SMS channel when the stored settings enable it and the phone is valid', function () {
    Storage::fake('local');
    SmsSettings::save(['enabled' => true, 'api_key' => 'demo-key']);

    $notification = new TicketMessageNotification(makeSmsTicket(), makeSmsMessage(), 'https://example.test/r');

    expect($notification->via(smsNotifiable()))->toBe([SmsFactoryChannel::class]);
});

it('returns no channel when the phone number is invalid', function () {
    Storage::fake('local');
    SmsSettings::save(['enabled' => true, 'api_key' => 'demo-key']);

    $notification = new TicketMessageNotification(
        makeSmsTicket(['contact_phone' => '12']),
        makeSmsMessage(),
        'https://example.test/r'
    );

    expect($notification->via(smsNotifiable('12')))->toBe([]);
});
