<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Alerte les agents 30 jours avant la fin d'un abonnement NinjaOne
Schedule::command('supportpc:remote-subscriptions-expiring')->dailyAt('08:00');
