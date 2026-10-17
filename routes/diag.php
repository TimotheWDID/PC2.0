<?php

use App\Http\Controllers\DiagnosticController;
use Illuminate\Support\Facades\Route;

// Quick diag: the Diag Atelier outside any ticket, attachable to a ticket afterwards
Route::middleware(['auth', 'agent'])->group(function () {
    Route::get('diag', [DiagnosticController::class, 'quickIndex'])->name('diag.index');
    Route::get('diag/tool', [DiagnosticController::class, 'quickTool'])->name('diag.tool');
    Route::post('diag/diagnostics', [DiagnosticController::class, 'quickStore'])->name('diag.diagnostics.store');
    Route::get('diag/diagnostics/{diagnostic}', [DiagnosticController::class, 'quickShow'])->whereNumber('diagnostic')->name('diag.diagnostics.show');
    Route::get('diag/diagnostics/{diagnostic}/files/{source}', [DiagnosticController::class, 'quickFile'])->whereNumber('diagnostic')->whereIn('source', ['aida', 'hwinfo', 'battery'])->name('diag.diagnostics.file');
    Route::post('diag/diagnostics/{diagnostic}/attach', [DiagnosticController::class, 'quickAttach'])->whereNumber('diagnostic')->name('diag.diagnostics.attach');
    Route::delete('diag/diagnostics/{diagnostic}', [DiagnosticController::class, 'quickDestroy'])->whereNumber('diagnostic')->name('diag.diagnostics.destroy');
});
