<?php

use App\Support\Sms\PhoneNumber;

it('normalizes national french numbers to E.164', function () {
    expect(PhoneNumber::normalize('0612345678', '+33'))->toBe('+33612345678')
        ->and(PhoneNumber::normalize('06 12 34 56 78', '+33'))->toBe('+33612345678')
        ->and(PhoneNumber::normalize('06.12.34.56.78', '+33'))->toBe('+33612345678')
        ->and(PhoneNumber::normalize('06-12-34-56-78', '+33'))->toBe('+33612345678')
        ->and(PhoneNumber::normalize('0389827633', '+33'))->toBe('+33389827633');
});

it('converts the 00 international prefix to +', function () {
    expect(PhoneNumber::normalize('0033612345678', '+33'))->toBe('+33612345678')
        ->and(PhoneNumber::normalize('0032470123456', '+33'))->toBe('+32470123456');
});

it('keeps numbers already in E.164 untouched', function () {
    expect(PhoneNumber::normalize('+33612345678', '+33'))->toBe('+33612345678')
        ->and(PhoneNumber::normalize('+33 6 12 34 56 78', '+33'))->toBe('+33612345678');
});

it('respects a custom default country code', function () {
    expect(PhoneNumber::normalize('0470123456', '+32'))->toBe('+32470123456');
});

it('uses the country code from the SMS settings when none is given', function () {
    Illuminate\Support\Facades\Storage::fake('local');
    config()->set('services.smsfactory.default_country_code', '+33');

    expect(PhoneNumber::normalize('0612345678'))->toBe('+33612345678');
});

it('rejects invalid numbers', function () {
    expect(PhoneNumber::normalize('', '+33'))->toBeNull()
        ->and(PhoneNumber::normalize('   ', '+33'))->toBeNull()
        ->and(PhoneNumber::normalize('abc', '+33'))->toBeNull()
        ->and(PhoneNumber::normalize('123', '+33'))->toBeNull()
        ->and(PhoneNumber::normalize('+0612345678', '+33'))->toBeNull()
        ->and(PhoneNumber::normalize('+3361234567890123456', '+33'))->toBeNull()
        ->and(PhoneNumber::normalize('06 12 34 xx 78', '+33'))->toBeNull();
});
