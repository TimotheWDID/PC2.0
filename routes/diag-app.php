<?php

use App\Http\Controllers\DiagAppController;
use App\Http\Controllers\DiagAppTicketController;
use App\Http\Controllers\DiagEventNoteController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\TicketFileController;
use Illuminate\Support\Facades\Route;

// API of the PC2 Diag Windows application, authenticated by its pairing key
Route::middleware(['diag-app', 'throttle:240,1'])->group(function () {
    Route::get('me', [DiagAppController::class, 'me'])->name('diag-app.me');
    Route::post('diagnostics', [DiagAppController::class, 'submit'])->name('diag-app.diagnostics.store');

    // Windows events taught by the technicians, shared by every app
    Route::get('event-notes', [DiagEventNoteController::class, 'apiIndex'])->name('diag-app.event-notes');
    Route::post('event-notes', [DiagEventNoteController::class, 'apiStore'])->name('diag-app.event-notes.store');

    // Tickets: same paths as on the site, so its download paths work here too
    Route::get('tickets', [DiagAppTicketController::class, 'index'])->name('diag-app.tickets');
    Route::get('tickets/create', [DiagAppTicketController::class, 'createOptions'])->name('diag-app.tickets.create');
    Route::post('tickets', [DiagAppTicketController::class, 'store'])->name('diag-app.tickets.store');
    Route::get('tickets/for-machine', [DiagAppTicketController::class, 'forMachine'])->name('diag-app.tickets.for-machine');
    Route::get('todos', [DiagAppTicketController::class, 'todos'])->name('diag-app.todos');

    Route::prefix('tickets/{ticket}')->whereNumber('ticket')->name('diag-app.tickets.')->group(function () {
        Route::get('/', [DiagAppTicketController::class, 'show'])->name('show');
        Route::patch('status', [DiagAppTicketController::class, 'updateStatus'])->name('status');
        Route::patch('priority', [DiagAppTicketController::class, 'updatePriority'])->name('priority');
        Route::post('assign-me', [DiagAppTicketController::class, 'assignToMe'])->name('assign-me');

        Route::post('timeline-events', [DiagAppTicketController::class, 'storeTimelineEvent'])->name('timeline.store');
        Route::patch('timeline-events/{event}/actions', [DiagAppTicketController::class, 'updateTimelineAction'])->whereNumber('event')->name('timeline.actions');
        Route::delete('timeline-events/{event}', [DiagAppTicketController::class, 'removeTimelineEvent'])->whereNumber('event')->name('timeline.remove');
        Route::patch('timeline-events/{event}/restore', [DiagAppTicketController::class, 'restoreTimelineEvent'])->whereNumber('event')->name('timeline.restore');
        Route::post('activity', [DiagAppTicketController::class, 'storeActivity'])->name('activity.store');
        Route::post('device-events', [DiagAppTicketController::class, 'storeDeviceEvent'])->name('device-events.store');

        Route::post('messages', [MessageController::class, 'store'])->name('messages.store');
        Route::delete('messages/{message}', [MessageController::class, 'destroy'])->whereNumber('message')->name('messages.destroy');
        Route::post('messages/{message}/validate-mention', [MessageController::class, 'validateMention'])->whereNumber('message')->name('messages.validate-mention');
        Route::get('messages/{message}/attachments/{attachment}', [MessageController::class, 'downloadAttachment'])->whereNumber(['message', 'attachment'])->name('messages.attachment');

        Route::post('files', [TicketFileController::class, 'store'])->name('files.store');
        Route::post('files/send', [TicketFileController::class, 'send'])->name('files.send');
        Route::patch('files/{file}', [TicketFileController::class, 'update'])->whereNumber('file')->name('files.update');
        Route::delete('files/{file}', [TicketFileController::class, 'destroy'])->whereNumber('file')->name('files.destroy');
        Route::get('files/{file}/download', [TicketFileController::class, 'download'])->whereNumber('file')->name('files.download');

        Route::patch('diagnostics/{diagnostic}/visibility', [DiagAppController::class, 'updateVisibility'])->whereNumber('diagnostic')->name('diagnostics.visibility');
        Route::get('diagnostics/{diagnostic}/files/{source}', [DiagAppController::class, 'file'])->whereNumber('diagnostic')->whereIn('source', ['app', 'aida', 'hwinfo', 'battery'])->name('diagnostics.file');
        Route::get('diagnostics/{diagnostic}/client-report', [DiagAppController::class, 'clientReport'])->whereNumber('diagnostic')->name('diagnostics.client-report');
    });
});
