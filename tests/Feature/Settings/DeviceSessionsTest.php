<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;

test('device sessions page is displayed', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->get(route('device-sessions.edit'));

    $response->assertOk();
});

test('guests are redirected from device sessions page', function () {
    $response = $this->get(route('device-sessions.edit'));

    $response->assertRedirect(route('login'));
});

test('user can logout other devices with correct password', function () {
    $user = User::factory()->create();

    $this->actingAs($user);

    DB::table('sessions')->insert([
        [
            'id' => session()->getId(),
            'user_id' => $user->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Current Device',
            'payload' => 'payload',
            'last_activity' => now()->timestamp,
        ],
        [
            'id' => 'other-session-id',
            'user_id' => $user->id,
            'ip_address' => '10.0.0.2',
            'user_agent' => 'Other Device',
            'payload' => 'payload',
            'last_activity' => now()->subMinutes(5)->timestamp,
        ],
    ]);

    $response = $this->delete(route('device-sessions.destroy-others'), [
        'password' => 'password',
    ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertSessionHas('status')
        ->assertRedirect();

    expect(DB::table('sessions')->where('id', 'other-session-id')->exists())->toBeFalse();
    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBeLessThanOrEqual(1);
});

test('correct password must be provided to logout other devices', function () {
    $user = User::factory()->create();

    $this->actingAs($user);

    DB::table('sessions')->insert([
        'id' => 'another-session-id',
        'user_id' => $user->id,
        'ip_address' => '10.0.0.3',
        'user_agent' => 'Other Device',
        'payload' => 'payload',
        'last_activity' => now()->timestamp,
    ]);

    $response = $this
        ->from(route('device-sessions.edit'))
        ->delete(route('device-sessions.destroy-others'), [
            'password' => 'wrong-password',
        ]);

    $response
        ->assertSessionHasErrors('password')
        ->assertRedirect(route('device-sessions.edit'));

    expect(DB::table('sessions')->where('id', 'another-session-id')->exists())->toBeTrue();
});
