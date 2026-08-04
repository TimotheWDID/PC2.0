<?php

use App\Support\Sms\SmsSettings;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('local');
});

it('migrates the legacy signature key to footer on load', function () {
    Storage::disk('local')->put('sms_factory.json', json_encode([
        'enabled' => true,
        'footer' => '',
        'signature' => 'Ancienne signature',
    ]));

    $settings = SmsSettings::load();

    expect($settings['footer'])->toBe('Ancienne signature')
        ->and($settings)->not->toHaveKey('signature');
});

it('keeps footer when both footer and signature exist', function () {
    Storage::disk('local')->put('sms_factory.json', json_encode([
        'footer' => 'Footer actuel',
        'signature' => 'Vieille signature',
    ]));

    expect(SmsSettings::load()['footer'])->toBe('Footer actuel');
});

it('never writes the signature key on save', function () {
    SmsSettings::save(['enabled' => true, 'footer' => 'X', 'signature' => 'Y']);

    $stored = json_decode((string) Storage::disk('local')->get('sms_factory.json'), true);

    expect($stored)->not->toHaveKey('signature')
        ->and($stored['footer'])->toBe('X');
});

it('uses 160 as the default max length', function () {
    config()->set('services.smsfactory.max_length', 160);

    expect(SmsSettings::defaults()['max_length'])->toBe(160)
        ->and(SmsSettings::DEFAULT_LENGTH)->toBe(160);
});

it('replaces default templates entirely with the stored ones', function () {
    SmsSettings::save(['templates' => [
        ['title' => 'Seul template', 'content' => 'Contenu'],
    ]]);

    $templates = SmsSettings::load()['templates'];

    expect($templates)->toHaveCount(1)
        ->and($templates[0]['title'])->toBe('Seul template');
});

it('respects the enabled toggle stored in the JSON file over the env config', function () {
    config()->set('services.smsfactory.enabled', true);
    config()->set('services.smsfactory.api_key', 'env-key');

    SmsSettings::save(['enabled' => false, 'api_key' => 'stored-key']);

    expect(SmsSettings::isEnabled())->toBeFalse();
});

it('is disabled when the api key is empty even if enabled is true', function () {
    SmsSettings::save(['enabled' => true, 'api_key' => '']);
    config()->set('services.smsfactory.api_key', null);

    expect(SmsSettings::isEnabled())->toBeFalse();
});

it('is enabled when the toggle is on and a key is present', function () {
    SmsSettings::save(['enabled' => true, 'api_key' => 'demo-key']);

    expect(SmsSettings::isEnabled())->toBeTrue();
});

it('exposes the new keys with sensible defaults', function () {
    config()->set('services.smsfactory.default_country_code', '+33');
    config()->set('services.smsfactory.timeout', 10.0);
    config()->set('services.smsfactory.verify_ssl', true);

    $defaults = SmsSettings::defaults();

    expect($defaults['default_country_code'])->toBe('+33')
        ->and($defaults['timeout'])->toBe(10.0)
        ->and($defaults['verify_ssl'])->toBeTrue();
});
