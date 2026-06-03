<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TicketController;
use App\Http\Controllers\MessageController;

Route::get('kiosk/tickets/create', [TicketController::class, 'kioskCreate'])->name('kiosk.tickets.create');
Route::post('kiosk/tickets', [TicketController::class, 'kioskStore'])->name('kiosk.tickets.store');

Route::middleware('auth')->group(function () {
    Route::get('tickets/bugs-improvements', [TicketController::class, 'specialIndex'])->name('tickets.special.index');
    Route::get('tickets/bugs-improvements/create', [TicketController::class, 'specialCreate'])->name('tickets.special.create');

    Route::get('tickets/print-settings', [TicketController::class, 'printSettings'])->name('tickets.printSettings');
    Route::get('tickets/{ticket}/print-label', [TicketController::class, 'printLabel'])->name('tickets.printLabel');

    Route::resource('tickets', TicketController::class)->whereNumber('ticket');

    // Update ticket status
    Route::patch('tickets/{ticket}/status', [TicketController::class, 'updateStatus'])->name('tickets.updateStatus');

    // Update ticket priority
    Route::patch('tickets/{ticket}/priority', [TicketController::class, 'updatePriority'])->name('tickets.updatePriority');
    Route::patch('tickets/{ticket}/self-assign', [TicketController::class, 'selfAssign'])->name('tickets.selfAssign');

    // Add a manual timeline event to a ticket
    Route::post('tickets/{ticket}/timeline-events', [TicketController::class, 'storeTimelineEvent'])->name('tickets.timelineEvents.store');
    Route::post('tickets/{ticket}/device-events', [TicketController::class, 'storeDeviceEvent'])->name('tickets.deviceEvents.store');
    Route::delete('tickets/{ticket}/timeline-events/{event}', [TicketController::class, 'removeTimelineEvent'])->name('tickets.timelineEvents.remove');
    Route::patch('tickets/{ticket}/timeline-events/{event}/restore', [TicketController::class, 'restoreTimelineEvent'])->name('tickets.timelineEvents.restore');

    // Link an existing commande to a ticket
    Route::patch('tickets/{ticket}/link-commande', [TicketController::class, 'linkCommande'])->name('tickets.linkCommande');
    Route::patch('tickets/{ticket}/attach-device', [TicketController::class, 'attachDevice'])->name('tickets.attachDevice');
    Route::post('tickets/{ticket}/create-device', [TicketController::class, 'createAndAttachDevice'])->name('tickets.createDevice');

    // Chat/Messages routes for tickets
    Route::get('tickets/{ticket}/messages', [MessageController::class, 'index'])->name('tickets.messages.index');
    Route::post('tickets/{ticket}/messages', [MessageController::class, 'store'])->name('tickets.messages.store');
    Route::delete('tickets/{ticket}/messages/{message}', [MessageController::class, 'destroy'])->name('tickets.messages.destroy');
});

