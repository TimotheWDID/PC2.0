<?php

use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::resource('users', UserController::class);
    Route::patch('users/{user}/internal-note', [UserController::class, 'updateInternalNote'])->name('users.update-internal-note');
    Route::post('users/{user}/send-password-email', [UserController::class, 'sendPasswordSetupEmail'])->name('users.send-password-email');
    Route::post('users/{user}/send-password-sms', [UserController::class, 'sendPasswordSetupSms'])->name('users.send-password-sms');
});
