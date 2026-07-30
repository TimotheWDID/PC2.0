<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $messagesTable = config('laravel_ticket.table_names.messages', 'messages');
        $tableName = is_array($messagesTable) && isset($messagesTable['table'])
            ? $messagesTable['table']
            : $messagesTable;

        Schema::table($tableName, function (Blueprint $table): void {
            $table->string('notification_channel', 16)->nullable()->after('attachments');
            $table->string('notification_status', 16)->nullable()->after('notification_channel')->index();
            $table->text('notification_error')->nullable()->after('notification_status');
            $table->timestamp('notified_at')->nullable()->after('notification_error');
        });
    }

    public function down(): void
    {
        $messagesTable = config('laravel_ticket.table_names.messages', 'messages');
        $tableName = is_array($messagesTable) && isset($messagesTable['table'])
            ? $messagesTable['table']
            : $messagesTable;

        Schema::table($tableName, function (Blueprint $table): void {
            $table->dropColumn([
                'notification_channel',
                'notification_status',
                'notification_error',
                'notified_at',
            ]);
        });
    }
};
