<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TicketController;
use App\Http\Controllers\MessageController;

Route::middleware('auth')->group(function () {
    Route::resource('tickets', TicketController::class);

    // Update ticket status
    Route::patch('tickets/{ticket}/status', [TicketController::class, 'updateStatus'])->name('tickets.updateStatus');

    // Update ticket priority
    Route::patch('tickets/{ticket}/priority', [TicketController::class, 'updatePriority'])->name('tickets.updatePriority');

    // Chat/Messages routes for tickets
    Route::get('tickets/{ticket}/messages', [MessageController::class, 'index'])->name('tickets.messages.index');
    Route::post('tickets/{ticket}/messages', [MessageController::class, 'store'])->name('tickets.messages.store');
    Route::delete('tickets/{ticket}/messages/{message}', [MessageController::class, 'destroy'])->name('tickets.messages.destroy');
});

