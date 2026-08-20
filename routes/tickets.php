<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\InternalTicketController;
use App\Http\Controllers\TicketController;
use App\Http\Controllers\TicketMagicLinkController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\Settings\InboundMailReviewController;

Route::get('t/{token}', [TicketMagicLinkController::class, 'show'])
    ->where('token', '(?:[A-Fa-f0-9]{64}|[A-Za-z0-9_-]{43}|[A-Za-z0-9_-]{22})')
    ->middleware('throttle:ticket-magic-link')
    ->name('tickets.magic.show');

// Public chat access is guarded in MessageController by magic token validation.
Route::get('tickets/{ticket}/messages', [MessageController::class, 'index'])
    ->middleware('throttle:ticket-messages')
    ->name('tickets.messages.index');
Route::post('tickets/{ticket}/messages', [MessageController::class, 'store'])
    ->middleware('throttle:ticket-messages')
    ->name('tickets.messages.store');

Route::get('kiosk/tickets/create', [TicketController::class, 'kioskCreate'])->name('kiosk.tickets.create');
Route::post('kiosk/tickets', [TicketController::class, 'kioskStore'])->name('kiosk.tickets.store');

Route::middleware('auth')->group(function () {
    Route::post('tickets/quick-user', [TicketController::class, 'quickCreateUser'])->name('tickets.quickUser');

    Route::middleware('agent')->group(function () {
        Route::get('tickets/inbound-mails', [InboundMailReviewController::class, 'index'])->name('tickets.inbound-mails.index');
        Route::post('tickets/inbound-mails/{inboundEmail}/attach', [InboundMailReviewController::class, 'attachToTicket'])->name('tickets.inbound-mails.attach');
        Route::post('tickets/inbound-mails/{inboundEmail}/dismiss', [InboundMailReviewController::class, 'dismiss'])->name('tickets.inbound-mails.dismiss');
    });

    Route::middleware('admin')->group(function () {
        Route::get('tickets/bulk-distribution', [TicketController::class, 'bulkDistributionIndex'])->name('tickets.bulkDistribution.index');
        Route::post('tickets/bulk-distribution', [TicketController::class, 'bulkDistributionAssign'])->name('tickets.bulkDistribution.assign');
    });

    Route::get('internal-tickets', [InternalTicketController::class, 'index'])->name('internalTickets.index');
    Route::get('internal-tickets/create', [InternalTicketController::class, 'create'])->name('internalTickets.create');
    Route::post('internal-tickets', [InternalTicketController::class, 'store'])->name('internalTickets.store');
    Route::get('internal-tickets/{internalTicket}', [InternalTicketController::class, 'show'])->name('internalTickets.show');
    Route::patch('internal-tickets/{internalTicket}/process', [InternalTicketController::class, 'process'])->name('internalTickets.process');

    Route::get('tickets/bugs-improvements', fn () => redirect()->route('internalTickets.index'))->name('tickets.special.index');
    Route::get('tickets/bugs-improvements/create', function () {
        $query = request()->query();

        return redirect()->route('internalTickets.create', $query);
    })->name('tickets.special.create');

    Route::get('tickets/print-settings', [TicketController::class, 'printSettings'])
        ->middleware('admin')
        ->name('tickets.printSettings');
    Route::get('tickets/technician-todos', [TicketController::class, 'technicianTodos'])->name('tickets.technicianTodos');
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
    Route::patch('tickets/{ticket}/timeline-events/{event}/actions', [TicketController::class, 'updateTimelineAction'])->name('tickets.timelineActions.update');
    Route::delete('tickets/{ticket}/timeline-events/{event}', [TicketController::class, 'removeTimelineEvent'])->name('tickets.timelineEvents.remove');
    Route::patch('tickets/{ticket}/timeline-events/{event}/restore', [TicketController::class, 'restoreTimelineEvent'])->name('tickets.timelineEvents.restore');

    // Link an existing commande to a ticket
    Route::patch('tickets/{ticket}/link-commande', [TicketController::class, 'linkCommande'])->name('tickets.linkCommande');
    Route::patch('tickets/{ticket}/attach-device', [TicketController::class, 'attachDevice'])->name('tickets.attachDevice');
    Route::post('tickets/{ticket}/create-device', [TicketController::class, 'createAndAttachDevice'])->name('tickets.createDevice');

    // Chat/Messages routes for tickets
    Route::post('tickets/{ticket}/messages/{message}/validate-mention', [MessageController::class, 'validateMention'])->name('tickets.messages.validateMention');
    Route::delete('tickets/{ticket}/messages/{message}', [MessageController::class, 'destroy'])->name('tickets.messages.destroy');
});

