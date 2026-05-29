<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TicketController;
use App\Http\Controllers\MessageController;

Route::middleware('auth')->group(function () {
    Route::get('tickets/print-settings', [TicketController::class, 'printSettings'])->name('tickets.printSettings');
    Route::get('tickets/{ticket}/print-label', [TicketController::class, 'printLabel'])->name('tickets.printLabel');

    Route::resource('tickets', TicketController::class)->whereNumber('ticket');

    // Update ticket status
    Route::patch('tickets/{ticket}/status', [TicketController::class, 'updateStatus'])->name('tickets.updateStatus');

    // Update ticket priority
    Route::patch('tickets/{ticket}/priority', [TicketController::class, 'updatePriority'])->name('tickets.updatePriority');

    // Link an existing commande to a ticket
    Route::patch('tickets/{ticket}/link-commande', [TicketController::class, 'linkCommande'])->name('tickets.linkCommande');

    // Chat/Messages routes for tickets
    Route::get('tickets/{ticket}/messages', [MessageController::class, 'index'])->name('tickets.messages.index');
    Route::post('tickets/{ticket}/messages', [MessageController::class, 'store'])->name('tickets.messages.store');
    Route::delete('tickets/{ticket}/messages/{message}', [MessageController::class, 'destroy'])->name('tickets.messages.destroy');
});

