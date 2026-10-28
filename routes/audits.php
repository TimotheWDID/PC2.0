<?php

use App\Http\Controllers\AuditController;
use Illuminate\Support\Facades\Route;

// Audits of a whole client: network scans, devices and their PC2 Diag diagnostics
Route::middleware(['auth', 'agent'])->group(function () {
    Route::get('audits', [AuditController::class, 'index'])->name('audits.index');
    Route::post('audits', [AuditController::class, 'storeAudit'])->name('audits.store');
    Route::get('audits/{audit}', [AuditController::class, 'showAudit'])->whereNumber('audit')->name('audits.show');
    Route::patch('audits/{audit}', [AuditController::class, 'updateAudit'])->whereNumber('audit')->name('audits.update');
    Route::delete('audits/{audit}', [AuditController::class, 'destroyAudit'])->whereNumber('audit')->name('audits.destroy');

    Route::prefix('audits/{audit}')->whereNumber('audit')->name('audits.')->group(function () {
        Route::get('report', [AuditController::class, 'report'])->name('report');

        Route::post('devices', [AuditController::class, 'storeDevice'])->name('devices.store');
        Route::patch('devices/{device}', [AuditController::class, 'updateDevice'])->whereNumber('device')->name('devices.update');
        Route::delete('devices/{device}', [AuditController::class, 'destroyDevice'])->whereNumber('device')->name('devices.destroy');
        Route::get('devices/{device}/diag', [AuditController::class, 'deviceTool'])->whereNumber('device')->name('devices.diag');
        Route::post('devices/{device}/diagnostics', [AuditController::class, 'storeDeviceDiagnostic'])->whereNumber('device')->name('devices.diagnostics.store');

        Route::post('network-scans/{scan}/hosts', [AuditController::class, 'addHosts'])->whereNumber('scan')->name('scans.hosts');
        Route::delete('network-scans/{scan}', [AuditController::class, 'destroyScan'])->whereNumber('scan')->name('scans.destroy');

        Route::get('diagnostics/{diagnostic}', [AuditController::class, 'showDiagnostic'])->whereNumber('diagnostic')->name('diagnostics.show');
        Route::get('diagnostics/{diagnostic}/files/{source}', [AuditController::class, 'diagnosticFile'])->whereNumber('diagnostic')->whereIn('source', ['app', 'aida', 'hwinfo', 'battery'])->name('diagnostics.file');
        Route::delete('diagnostics/{diagnostic}', [AuditController::class, 'destroyDiagnostic'])->whereNumber('diagnostic')->name('diagnostics.destroy');
    });
});
