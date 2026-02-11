<?php

namespace Coderflex\LaravelTicket\Database\Factories;

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up()
    {
        $tableName = config('laravel_ticket.table_names.messages', 'messages');

        // the config can return an array with ['table' => 'messages', 'columns' => [...]]
        $messagesTable = is_array($tableName) && isset($tableName['table']) ? $tableName['table'] : $tableName;

        Schema::create($messagesTable, function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained(config('laravel_ticket.table_names.tickets', 'tickets'))->onDelete('cascade');
            $table->foreignId('author_id')->constrained('users')->onDelete('cascade');
            $table->text('content');
            $table->boolean('is_internal')->default(false);
            $table->json('attachments')->nullable();
            $table->timestamps();
        });
    }
};
