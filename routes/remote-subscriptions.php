<?php

use App\Http\Controllers\RemoteSubscriptionController;
use Illuminate\Support\Facades\Route;

// NinjaOne remote support: subscriptions, remaining time and remote interventions
Route::middleware(['auth', 'agent'])->group(function () {
    Route::resource('remote-subscriptions', RemoteSubscriptionController::class)
        ->only(['index', 'store', 'show', 'update', 'destroy']);
    Route::post('remote-subscriptions/{remoteSubscription}/interventions', [RemoteSubscriptionController::class, 'storeIntervention'])
        ->name('remote-subscriptions.interventions.store');
    Route::delete('remote-subscriptions/{remoteSubscription}/interventions/{intervention}', [RemoteSubscriptionController::class, 'destroyIntervention'])
        ->name('remote-subscriptions.interventions.destroy');
});
