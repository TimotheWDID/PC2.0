<?php

use App\Http\Controllers\AgentController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'admin'])->group(function () {
    Route::resource('agents', AgentController::class);
});
