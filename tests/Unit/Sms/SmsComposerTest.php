<?php

use App\Support\Sms\SmsComposer;

function composer(array $overrides = []): SmsComposer
{
    return new SmsComposer(array_merge([
        'header' => '',
        'footer' => '',
        'max_length' => 160,
    ], $overrides));
}

it('replaces magic link and signature placeholders in every casing', function () {
    $smsComposer = composer(['footer' => 'Ma signature']);

    $result = $smsComposer->compose(
        'Lien: [MagicLink] ou [magiclink] ou [MAGICLINK], signé [signature] / [Signature]',
        ['magic_link' => 'https://t.example/x'],
    );

    expect($result)->toBe('Lien: https://t.example/x ou https://t.example/x ou https://t.example/x, signé Ma signature / Ma signature');
});

it('keeps the magic link placeholder literal when no link is available', function () {
    expect(composer()->compose('Voir [MagicLink]'))->toBe('Voir [MagicLink]');
});

it('leaves short content untouched', function () {
    $text = "Bonjour,\n\nvoici la réponse.";

    expect(composer()->compose($text))->toBe($text);
});

it('applies header and footer decorations when requested', function () {
    $smsComposer = composer(['header' => 'Entête', 'footer' => 'Pied']);

    expect($smsComposer->compose('Contenu', [], withDecorations: true))
        ->toBe("Entête\n\nContenu\n\nPied");
});

it('skips empty decoration segments', function () {
    $smsComposer = composer(['header' => '', 'footer' => 'Pied']);

    expect($smsComposer->compose('Contenu', [], withDecorations: true))
        ->toBe("Contenu\n\nPied");
});

it('truncates long content while preserving the full magic link and footer', function () {
    $link = 'https://example.test/tickets/1234567890/abc?token=0123456789abcdef';
    $smsComposer = composer(['footer' => '03.89.82.76.33']);

    $result = $smsComposer->compose(
        str_repeat('Texte très long. ', 20) . '[MagicLink]',
        ['magic_link' => $link],
    );

    expect(mb_strlen($result))->toBeLessThanOrEqual(160)
        ->and($result)->toContain($link)
        ->and($result)->toContain('03.89.82.76.33');
});

it('appends the footer when truncating even if the content did not include it', function () {
    $link = 'https://example.test/t/abc';
    $smsComposer = composer(['footer' => 'Signature']);

    $result = $smsComposer->compose(
        str_repeat('Beaucoup de contenu ici. ', 30) . $link,
    );

    expect(mb_strlen($result))->toBeLessThanOrEqual(160)
        ->and($result)->toContain($link)
        ->and($result)->toEndWith('Signature');
});

it('truncates plain long text without link at max length', function () {
    $result = composer(['max_length' => 20])->compose('Un message vraiment beaucoup trop long');

    expect(mb_strlen($result))->toBeLessThanOrEqual(20);
});

it('keeps only the link when the limit is too small for any body', function () {
    $link = 'https://example.test/t/abcdef';
    $result = composer(['max_length' => mb_strlen($link) + 1])
        ->compose('Préfixe assez long avant le lien ' . $link);

    expect($result)->toBe($link);
});

it('hard-truncates the link itself when longer than the limit', function () {
    $link = 'https://example.test/tickets/very-long-token-1234567890';
    $result = composer(['max_length' => 20])->compose('Message ' . $link);

    expect(mb_strlen($result))->toBeLessThanOrEqual(20)
        ->and($result)->toStartWith('https://');
});

it('returns an empty string for empty content', function () {
    expect(composer()->compose('  '))->toBe('');
});
