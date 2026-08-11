<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\AppSettingsController;

Route::get('/', function () {
    return auth()->check()
        ? redirect()->route('dashboard')
        : redirect()->route('login');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [\App\Http\Controllers\DashboardController::class, 'index'])->name('dashboard');
    Route::post('dashboard/notifications/validate-ticket/{ticket}', [\App\Http\Controllers\DashboardController::class, 'validateTicketNotifications'])
        ->name('dashboard.notifications.validate-ticket');
});

Route::middleware(['auth', 'admin'])->group(function () {
    Route::get('admin/dashboard', [\App\Http\Controllers\AdminDashboardController::class, 'index'])->name('admin.dashboard');
    Route::get('app-settings', function () {
        return redirect()->route('application-settings.edit');
    })->name('app-settings.edit');
    Route::post('app-settings/mail-footer', [AppSettingsController::class, 'updateMailFooter'])->name('app-settings.mail-footer.update');
    Route::post('app-settings/categories', [AppSettingsController::class, 'storeCategory'])->name('app-settings.categories.store');
    Route::delete('app-settings/categories/{category}', [AppSettingsController::class, 'destroyCategory'])->name('app-settings.categories.destroy');
    Route::post('app-settings/specialities', [AppSettingsController::class, 'storeSpeciality'])->name('app-settings.specialities.store');
    Route::delete('app-settings/specialities/{speciality}', [AppSettingsController::class, 'destroySpeciality'])->name('app-settings.specialities.destroy');
});
require __DIR__.'/tickets.php';
require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
require __DIR__.'/users.php';
require __DIR__.'/agents.php';
