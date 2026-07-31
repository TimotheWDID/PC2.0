<?php

use App\Models\Device;
use App\Models\User;

it('allows updating a device through the user device route', function () {
    $user = User::factory()->create();
    $device = Device::create([
        'user_id' => $user->id,
        'device_type' => 'computer',
        'brand' => 'Dell',
        'model' => 'Latitude',
        'serial_number' => 'SN-001',
        'asset_tag' => 'TAG-001',
        'status' => 'active',
        'notes' => 'Initial note',
    ]);

    $response = $this
        ->actingAs($user)
        ->patch(route('users.devices.update', ['user' => $user, 'device' => $device]), [
            'device_type' => 'phone',
            'brand' => 'Apple',
            'model' => 'iPhone 15',
            'serial_number' => 'SN-002',
            'asset_tag' => 'TAG-002',
            'purchase_date' => '2025-01-15',
            'warranty_start_date' => '2025-01-15',
            'warranty_end_date' => '2027-01-15',
            'status' => 'in_repair',
            'notes' => 'Updated note',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $device->refresh();

    expect($device->device_type)->toBe('phone')
        ->and($device->brand)->toBe('Apple')
        ->and($device->model)->toBe('iPhone 15')
        ->and($device->status)->toBe('in_repair')
        ->and($device->notes)->toBe('Updated note');
});
