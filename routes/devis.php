<?php

use App\Http\Controllers\DevisController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::resource('devis', DevisController::class)
        ->parameters(['devis' => 'devis'])
        ->only(['index', 'create', 'store', 'show', 'update']);
    Route::post('devis/{devis}/accept', [DevisController::class, 'accept'])->name('devis.accept');
    Route::get('devis/{devis}/download', [DevisController::class, 'download'])->name('devis.download');
    Route::get('devis/{devis}/preview', [DevisController::class, 'preview'])->name('devis.preview');
    Route::post('devis/{devis}/pdf', [DevisController::class, 'uploadPdf'])->name('devis.pdf.upload');
    Route::post('devis/{devis}/messages', [DevisController::class, 'storeMessage'])->name('devis.messages.store');
});
