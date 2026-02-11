<?php

use App\Http\Controllers\CommandeController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function () {
    Route::get('commandes/create-bulk', [CommandeController::class, 'createBulk'])->name('commandes.createBulk');
    Route::post('commandes/bulk-store', [CommandeController::class, 'bulkStore'])->name('commandes.bulkStore');
    Route::resource('commandes', CommandeController::class);
    Route::patch('commandes/{commande}/status', [CommandeController::class, 'updateStatus'])->name('commandes.updateStatus');
});
