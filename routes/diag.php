<?php

use App\Http\Controllers\DiagAppController;
use App\Http\Controllers\DiagnosticController;
use Illuminate\Support\Facades\Route;

// Quick diag: the Diag Atelier outside any ticket, attachable to a ticket afterwards
Route::middleware(['auth', 'agent'])->group(function () {
    Route::get('diag', [DiagnosticController::class, 'quickIndex'])->name('diag.index');
    Route::get('diag/tool', [DiagnosticController::class, 'quickTool'])->name('diag.tool');
    Route::post('diag/diagnostics', [DiagnosticController::class, 'quickStore'])->name('diag.diagnostics.store');
    Route::get('diag/diagnostics/{diagnostic}', [DiagnosticController::class, 'quickShow'])->whereNumber('diagnostic')->name('diag.diagnostics.show');
    Route::get('diag/diagnostics/{diagnostic}/files/{source}', [DiagnosticController::class, 'quickFile'])->whereNumber('diagnostic')->whereIn('source', ['app', 'aida', 'hwinfo', 'battery'])->name('diag.diagnostics.file');
    Route::post('diag/diagnostics/{diagnostic}/attach', [DiagnosticController::class, 'quickAttach'])->whereNumber('diagnostic')->name('diag.diagnostics.attach');
    Route::delete('diag/diagnostics/{diagnostic}', [DiagnosticController::class, 'quickDestroy'])->whereNumber('diagnostic')->name('diag.diagnostics.destroy');

    // Pairing keys of the PC2 Diag Windows application
    Route::post('diag/app-tokens', [DiagAppController::class, 'issueToken'])->middleware('throttle:10,1')->name('diag.app-tokens.store');
    Route::delete('diag/app-tokens/{token}', [DiagAppController::class, 'revokeToken'])->whereNumber('token')->name('diag.app-tokens.destroy');
});
