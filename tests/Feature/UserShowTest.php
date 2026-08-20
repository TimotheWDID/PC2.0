<?php

use App\Models\Device;
use App\Models\Ticket;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('authenticated users can view a user show page', function () {
    /** @var \Tests\TestCase $this */
    $viewer = User::factory()->create();
    $user = User::factory()->create([
        'first_name' => 'Jean',
        'last_name' => 'Dupont',
        'email' => 'jean.dupont@example.test',
        'phone' => '0601020304',
        'address' => '12 rue des Lilas',
        'hiboutik_id' => 'HIB-42',
        'default_notification_preference' => 'Email',
    ]);

    $device = Device::create([
        'user_id' => $user->id,
        'device_type' => 'computer',
        'brand' => 'Dell',
        'model' => 'Latitude 7420',
        'serial_number' => 'SN-USER-SHOW-1',
        'asset_tag' => 'AT-USER-SHOW-1',
        'status' => 'active',
    ]);

    $ticket = Ticket::create([
        'user_id' => $user->id,
        'device_id' => $device->id,
        'title' => 'Ecran noir au demarrage',
        'message' => 'Le poste ne demarre plus ce matin.',
        'priority' => 'high',
        'status' => 'open',
        'notify_by' => 'Email',
        'contact_email' => $user->email,
    ]);

    $this->actingAs($viewer)
        ->get(route('users.show-page', $user))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Users/Show')
            ->where('user.id', $user->id)
            ->where('user.name', 'Jean Dupont')
            ->where('user.email', 'jean.dupont@example.test')
            ->where('devices.0.id', $device->id)
            ->where('devices.0.display_name', $device->display_name)
            ->where('tickets.0.id', $ticket->id)
            ->where('tickets.0.device.id', $device->id)
        );
});

test('authenticated users can open user edit page', function () {
    /** @var \Tests\TestCase $this */
    $viewer = User::factory()->create();
    $user = User::factory()->create([
        'first_name' => 'Claire',
        'last_name' => 'Martin',
        'email' => 'claire.martin@example.test',
        'phone' => '0611223344',
        'address' => '8 avenue Victor Hugo',
        'default_notification_preference' => 'None',
    ]);

    $this->actingAs($viewer)
        ->get(route('users.edit', $user))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Users/Edit')
            ->where('user.id', $user->id)
            ->where('user.first_name', 'Claire')
            ->where('user.last_name', 'Martin')
            ->where('user.email', 'claire.martin@example.test')
        );
});
