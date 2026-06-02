<?php

use App\Http\Controllers\UserController;
use App\Http\Controllers\DeviceController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('devices', [DeviceController::class, 'index'])->name('devices.index');
    Route::resource('users', UserController::class);
    Route::patch('users/{user}/internal-note', [UserController::class, 'updateInternalNote'])->name('users.update-internal-note');
    Route::post('users/{user}/send-password-email', [UserController::class, 'sendPasswordSetupEmail'])->name('users.send-password-email');
    Route::post('users/{user}/send-password-sms', [UserController::class, 'sendPasswordSetupSms'])->name('users.send-password-sms');
    Route::post('users/{user}/devices', [DeviceController::class, 'store'])->name('users.devices.store');
    Route::patch('users/{user}/devices/{device}', [DeviceController::class, 'update'])->name('users.devices.update');
    Route::delete('users/{user}/devices/{device}', [DeviceController::class, 'destroy'])->name('users.devices.destroy');
});
