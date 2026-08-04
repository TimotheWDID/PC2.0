<?php

use App\Http\Controllers\Settings\PasswordController;
use App\Http\Controllers\Settings\DeviceSessionController;
use App\Http\Controllers\Settings\PreviewModeController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\TwoFactorAuthenticationController;
use App\Http\Controllers\Settings\TicketLabelController;
use App\Http\Controllers\Settings\TicketActionListController;
use App\Http\Controllers\Settings\TicketTimelineTemplateController;
use App\Http\Controllers\Settings\DashboardInsightController;
use App\Http\Controllers\Settings\InboundMailReviewController;
use App\Http\Controllers\Settings\MailDebugController;
use App\Http\Controllers\Settings\SmsSettingsController;
use App\Http\Controllers\Settings\SmsDebugController;
use App\Http\Controllers\Settings\EditableDataController;
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

    Route::get('settings/ticket-action-lists', [TicketActionListController::class, 'edit'])
        ->middleware('admin')
        ->name('ticket-action-lists.edit');
    Route::put('settings/ticket-action-lists', [TicketActionListController::class, 'update'])
        ->middleware('admin')
        ->name('ticket-action-lists.update');

    Route::get('settings/dashboard-insights', [DashboardInsightController::class, 'edit'])
        ->middleware('admin')
        ->name('dashboard-insights.edit');
    Route::put('settings/dashboard-insights', [DashboardInsightController::class, 'update'])
        ->middleware('admin')
        ->name('dashboard-insights.update');

    Route::get('settings/sms-debug', [SmsDebugController::class, 'edit'])
        ->middleware('admin')
        ->name('sms-debug.edit');
    Route::post('settings/sms-debug', [SmsDebugController::class, 'send'])
        ->middleware('admin')
        ->name('sms-debug.send');

    Route::get('settings/sms', [SmsSettingsController::class, 'edit'])
        ->middleware('admin')
        ->name('sms.edit');
    Route::get('settings/sms/templates', [SmsSettingsController::class, 'templates'])
        ->middleware('admin')
        ->name('sms.templates');
    Route::put('settings/sms/templates', [SmsSettingsController::class, 'updateTemplates'])
        ->middleware('admin')
        ->name('sms.templates.update');
    Route::put('settings/sms', [SmsSettingsController::class, 'update'])
        ->middleware('admin')
        ->name('sms.update');

    Route::get('settings/mail-debug', [MailDebugController::class, 'edit'])
        ->middleware('admin')
        ->name('mail-debug.edit');
    Route::post('settings/mail-debug', [MailDebugController::class, 'send'])
        ->middleware('admin')
        ->name('mail-debug.send');

    Route::get('settings/inbound-mail-review', [InboundMailReviewController::class, 'index'])
        ->middleware('admin')
        ->name('inbound-mail-review.index');
    Route::post('settings/inbound-mail-review/{inboundEmail}/attach', [InboundMailReviewController::class, 'attachToTicket'])
        ->middleware('admin')
        ->name('inbound-mail-review.attach');
    Route::post('settings/inbound-mail-review/{inboundEmail}/dismiss', [InboundMailReviewController::class, 'dismiss'])
        ->middleware('admin')
        ->name('inbound-mail-review.dismiss');

    Route::get('settings/application', function () {
        return redirect('/app-settings');
    })->middleware('admin')->name('application-settings.edit');

    Route::get('settings/editable-data', [EditableDataController::class, 'edit'])
        ->middleware('admin')
        ->name('editable-data.edit');
    Route::post('settings/editable-data/categories', [EditableDataController::class, 'storeCategory'])
        ->middleware('admin')
        ->name('editable-data.categories.store');
    Route::delete('settings/editable-data/categories/{category}', [EditableDataController::class, 'destroyCategory'])
        ->middleware('admin')
        ->name('editable-data.categories.destroy');
    Route::post('settings/editable-data/specialities', [EditableDataController::class, 'storeSpeciality'])
        ->middleware('admin')
        ->name('editable-data.specialities.store');
    Route::delete('settings/editable-data/specialities/{speciality}', [EditableDataController::class, 'destroySpeciality'])
        ->middleware('admin')
        ->name('editable-data.specialities.destroy');

    Route::get('settings/two-factor', [TwoFactorAuthenticationController::class, 'show'])
        ->name('two-factor.show');
});
