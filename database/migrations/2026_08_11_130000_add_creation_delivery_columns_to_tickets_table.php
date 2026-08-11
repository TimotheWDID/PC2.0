<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->string('creation_notification_channel', 16)
                ->nullable()
                ->after('contact_email');
            $table->string('creation_notification_status', 16)
                ->nullable()
                ->after('creation_notification_channel')
                ->index();
            $table->text('creation_notification_error')
                ->nullable()
                ->after('creation_notification_status');
            $table->timestamp('creation_notified_at')
                ->nullable()
                ->after('creation_notification_error');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn([
                'creation_notification_channel',
                'creation_notification_status',
                'creation_notification_error',
                'creation_notified_at',
            ]);
        });
    }
};
