<?php

use App\Http\Controllers\Settings\PasswordController;
use App\Http\Controllers\Settings\DeviceSessionController;
use App\Http\Controllers\Settings\PreviewModeController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\TwoFactorAuthenticationController;
use App\Http\Controllers\Settings\TicketLabelController;
use App\Http\Controllers\Settings\TicketTimelineTemplateController;
use App\Http\Controllers\Settings\DashboardInsightController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware('auth')->group(function () {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('settings/password', [PasswordController::class, 'edit'])->name('password.edit');

    Route::put('settings/password', [PasswordController::class, 'update'])
        ->middleware('throttle:6,1')
        ->name('password.update');

    Route::get('settings/device-sessions', [DeviceSessionController::class, 'edit'])
        ->name('device-sessions.edit');
    Route::delete('settings/device-sessions/others', [DeviceSessionController::class, 'destroyOthers'])
        ->middleware('throttle:6,1')
        ->name('device-sessions.destroy-others');

    Route::post('settings/preview/non-agent/toggle', [PreviewModeController::class, 'toggleNonAgent'])
        ->name('preview.non-agent.toggle');

    Route::post('settings/preview/mode', [PreviewModeController::class, 'setMode'])
        ->name('preview.mode.set');

    Route::get('settings/appearance', function () {
        return Inertia::render('settings/appearance');
    })->name('appearance.edit');

    Route::get('settings/ticket-label', [TicketLabelController::class, 'edit'])
        ->middleware('admin')
        ->name('ticket-label.edit');
    Route::put('settings/ticket-label', [TicketLabelController::class, 'update'])
        ->middleware('admin')
        ->name('ticket-label.update');

    Route::get('settings/ticket-timeline-templates', [TicketTimelineTemplateController::class, 'edit'])
        ->middleware('admin')
        ->name('ticket-timeline-templates.edit');
    Route::put('settings/ticket-timeline-templates', [TicketTimelineTemplateController::class, 'update'])
        ->middleware('admin')
        ->name('ticket-timeline-templates.update');

    Route::get('settings/dashboard-insights', [DashboardInsightController::class, 'edit'])
        ->middleware('admin')
        ->name('dashboard-insights.edit');
    Route::put('settings/dashboard-insights', [DashboardInsightController::class, 'update'])
        ->middleware('admin')
        ->name('dashboard-insights.update');

    Route::get('settings/two-factor', [TwoFactorAuthenticationController::class, 'show'])
        ->name('two-factor.show');
});
