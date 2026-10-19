<?php

use App\Http\Controllers\DiagAppController;
use Illuminate\Support\Facades\Route;

// API of the PC2 Diag Windows application, authenticated by its pairing key
Route::middleware(['diag-app', 'throttle:120,1'])->group(function () {
    Route::get('me', [DiagAppController::class, 'me'])->name('diag-app.me');
    Route::get('tickets', [DiagAppController::class, 'tickets'])->name('diag-app.tickets');
    Route::get('tickets/{ticket}', [DiagAppController::class, 'ticket'])->whereNumber('ticket')->name('diag-app.ticket');
    Route::post('diagnostics', [DiagAppController::class, 'submit'])->name('diag-app.diagnostics.store');
});
