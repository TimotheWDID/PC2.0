<?php

use App\Models\Agent;
use App\Models\User;
use App\Support\Sms\SmsSettings;
use Illuminate\Support\Facades\Storage;

function makeSmsAdmin(): User
{
    $user = User::factory()->create();
    Agent::create([
        'user_id' => $user->id,
        'is_admin' => true,
        'is_active' => true,
    ]);

    return $user;
}

function validSmsPayload(array $overrides = []): array
{
    return array_merge([
        'enabled' => true,
        'base_url' => 'https://api.smsfactor.com',
        'send_path' => '/send',
        'max_length' => 160,
        'api_key' => '',
        'auth_header' => 'X-API-KEY',
        'auth_prefix' => '',
        'sender' => 'SupportPC',
        'header' => '',
        'footer' => 'Signature',
        'default_country_code' => '+33',
        'timeout' => 10,
        'verify_ssl' => true,
        'templates' => [],
    ], $overrides);
}

it('keeps the stored api key when an empty key is submitted', function () {
    Storage::fake('local');
    SmsSettings::save(['enabled' => true, 'api_key' => 'secret-key']);

    $this->actingAs(makeSmsAdmin())
        ->put('/settings/sms', validSmsPayload())
        ->assertRedirect();

    expect(SmsSettings::load()['api_key'])->toBe('secret-key');
});

it('replaces the api key when a new one is submitted', function () {
    Storage::fake('local');
    SmsSettings::save(['enabled' => true, 'api_key' => 'old-key']);

    $this->actingAs(makeSmsAdmin())
        ->put('/settings/sms', validSmsPayload(['api_key' => 'new-key']))
        ->assertRedirect();

    expect(SmsSettings::load()['api_key'])->toBe('new-key');
});

it('never exposes the api key to the frontend', function () {
    Storage::fake('local');
    SmsSettings::save(['enabled' => true, 'api_key' => 'secret-key']);

    $this->actingAs(makeSmsAdmin())
        ->get('/settings/sms')
        ->assertInertia(fn ($page) => $page
            ->component('settings/sms')
            ->where('settings.api_key', '')
            ->where('settings.api_key_set', true)
        );
});

it('updates the templates without touching the rest of the configuration', function () {
    Storage::fake('local');
    SmsSettings::save([
        'enabled' => true,
        'api_key' => 'secret-key',
        'sender' => 'MonSender',
        'footer' => 'Mon footer',
    ]);

    $this->actingAs(makeSmsAdmin())
        ->put('/settings/sms/templates', [
            'templates' => [
                ['title' => 'Nouveau', 'content' => 'Contenu du template'],
            ],
        ])
        ->assertRedirect();

    $settings = SmsSettings::load();

    expect($settings['templates'])->toHaveCount(1)
        ->and($settings['templates'][0]['title'])->toBe('Nouveau')
        ->and($settings['api_key'])->toBe('secret-key')
        ->and($settings['sender'])->toBe('MonSender')
        ->and($settings['footer'])->toBe('Mon footer');
});

it('rejects an invalid default country code', function () {
    Storage::fake('local');

    $this->actingAs(makeSmsAdmin())
        ->put('/settings/sms', validSmsPayload(['default_country_code' => '33']))
        ->assertSessionHasErrors('default_country_code');
});
