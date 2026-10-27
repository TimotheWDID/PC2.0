<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Audits of a whole client (company or person): the network scans run by
     * PC2 Diag on the client's LAN, the devices found or added by hand, and
     * the PC2 Diag diagnostics of those devices.
     */
    public function up(): void
    {
        Schema::create('audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('technician_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->string('status', 20)->default('draft');
            $table->string('site_name')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });

        Schema::create('audit_network_scans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audit_id')->constrained('audits')->cascadeOnDelete();
            $table->foreignId('technician_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('machine_name')->nullable();
            $table->string('subnet', 50)->nullable();
            $table->string('local_ip', 45)->nullable();
            $table->string('gateway', 45)->nullable();
            $table->string('dns')->nullable();
            $table->string('public_ip', 45)->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->unsignedSmallInteger('host_count')->default(0);
            $table->json('hosts');
            $table->timestamps();
        });

        Schema::create('audit_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audit_id')->constrained('audits')->cascadeOnDelete();
            $table->foreignId('device_id')->nullable()->constrained('devices')->nullOnDelete();
            $table->string('kind', 30)->default('computer');
            $table->string('name');
            $table->string('hostname')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('mac', 17)->nullable();
            $table->string('serial_number')->nullable();
            $table->string('location')->nullable();
            $table->string('assigned_to')->nullable();
            $table->string('status', 20)->default('todo');
            $table->string('source', 20)->default('manual');
            $table->json('open_ports')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['audit_id', 'kind']);
        });

        Schema::table('diagnostics', function (Blueprint $table) {
            $table->foreignId('audit_device_id')->nullable()->after('device_id')->constrained('audit_devices')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('diagnostics', function (Blueprint $table) {
            $table->dropForeign(['audit_device_id']);
            $table->dropColumn('audit_device_id');
        });
        Schema::dropIfExists('audit_devices');
        Schema::dropIfExists('audit_network_scans');
        Schema::dropIfExists('audits');
    }
};
