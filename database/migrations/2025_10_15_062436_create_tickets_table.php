<?php

namespace Coderflex\LaravelTicket\Database\Factories;

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        $tableName = config('laravel_ticket.table_names.tickets', 'tickets');

        Schema::create($tableName, function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->nullable();
            $table->foreignId('user_id');
            $table->string('invoice_id')->nullable();
            $table->string('title');
            $table->text('message')->nullable();
            $table->string('priority')->default('low');
            $table->string('status')->default('open');
            // create category_id column now; add FK in separate migration to avoid ordering issues
            $table->foreignId('category_id')->nullable();
            $table->foreignId('assignee_id')->nullable()->constrained(config('laravel_ticket.table_names.users', 'users'))->onDelete('set null');
            $table->enum('notify_by', ['SMS', 'Email', 'None'])->default('None');
            $table->string('contact_phone')->nullable();
            $table->string('contact_email')->nullable();
            $table->boolean('is_resolved')->default(false);
            $table->boolean('is_locked')->default(false);
            $table->timestamps();
        });
    }
};
