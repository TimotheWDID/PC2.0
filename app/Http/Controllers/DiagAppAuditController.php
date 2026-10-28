<?php

namespace App\Http\Controllers;

use App\Models\Audit;
use App\Models\AuditDevice;
use App\Models\AuditNetworkScan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Audits in the PC2 Diag Windows application: choose the audit, send the
 * network scan of the client's LAN and the diagnostic of each of its PCs.
 */
class DiagAppAuditController extends AuditController
{
    private const MAX_HOSTS = 1024;

    public function apiIndex(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('q', ''));

        $audits = Audit::query()
            ->with(['client:id,client_type,company_name,first_name,last_name', 'technician:id,first_name,last_name'])
            ->withCount(['devices', 'devices as diagnosed_count' => fn ($q) => $q->where('status', 'done')])
            ->when(! $request->boolean('all'), fn ($q) => $q->where('status', '!=', 'done'))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    if (ctype_digit($search)) {
                        $q->where('id', (int) $search);
                    }
                    $q->orWhere('title', 'like', '%'.$search.'%')
                        ->orWhere('site_name', 'like', '%'.$search.'%')
                        ->orWhereHas('client', fn ($c) => $c->where('company_name', 'like', '%'.$search.'%')
                            ->orWhere('first_name', 'like', '%'.$search.'%')
                            ->orWhere('last_name', 'like', '%'.$search.'%'));
                });
            })
            ->orderByRaw("CASE status WHEN 'in_progress' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END")
            ->orderByDesc('updated_at')
            ->limit(100)
            ->get()
            ->map(fn (Audit $audit) => [
                ...$this->presentAudit($audit),
                'url' => route('audits.show', $audit),
                'devices_count' => $audit->devices_count,
                'diagnosed_count' => $audit->diagnosed_count,
            ]);

        return response()->json(['audits' => $audits]);
    }

    public function apiShow(Audit $audit): JsonResponse
    {
        $audit->load(['client', 'technician:id,first_name,last_name']);

        $devices = $audit->devices()
            ->with(['device:id,brand,model,serial_number,device_type', 'latestDiagnostic.technician:id,first_name,last_name'])
            ->orderBy('name')
            ->get()
            ->map(fn (AuditDevice $device) => $this->presentDevice($audit, $device));

        $scans = $audit->networkScans()
            ->latest()
            ->limit(20)
            ->get(['id', 'audit_id', 'created_at', 'machine_name', 'subnet', 'host_count'])
            ->map(fn (AuditNetworkScan $scan) => [
                'id' => $scan->id,
                'created_at' => $scan->created_at?->toIso8601String(),
                'machine_name' => $scan->machine_name,
                'subnet' => $scan->subnet,
                'host_count' => $scan->host_count,
            ]);

        return response()->json([
            'audit' => [
                ...$this->presentAudit($audit),
                'url' => route('audits.show', $audit),
                'report_url' => route('audits.report', $audit),
            ],
            'devices' => $devices,
            'scans' => $scans,
            'kinds' => AuditDevice::KINDS,
        ]);
    }

    /**
     * Network scan run by the app on the client's LAN. With add_devices, every
     * host found also becomes (or updates) a device of the audit.
     */
    public function apiStoreScan(Request $request, Audit $audit): JsonResponse
    {
        $data = $request->validate([
            'subnet' => 'nullable|string|max:50',
            'local_ip' => 'nullable|string|max:45',
            'gateway' => 'nullable|string|max:45',
            'dns' => 'nullable|string|max:255',
            'public_ip' => 'nullable|string|max:45',
            'duration_ms' => 'nullable|integer|min:0',
            'add_devices' => 'nullable|boolean',
            'hosts' => 'present|array|max:'.self::MAX_HOSTS,
            'hosts.*.ip' => 'required|ip',
            'hosts.*.mac' => 'nullable|string|max:20',
            'hosts.*.hostname' => 'nullable|string|max:255',
            'hosts.*.vendor' => 'nullable|string|max:255',
            'hosts.*.kind' => ['nullable', Rule::in(array_keys(AuditDevice::KINDS))],
            'hosts.*.kind_hint' => 'nullable|string|max:255',
            'hosts.*.ports' => 'nullable|array|max:64',
            'hosts.*.ports.*' => 'integer|min:1|max:65535',
            'hosts.*.rtt_ms' => 'nullable|integer|min:0',
            'hosts.*.self' => 'nullable|boolean',
            'hosts.*.gateway' => 'nullable|boolean',
        ]);

        $hosts = collect($data['hosts'])->map(fn (array $host) => array_filter([
            'ip' => $host['ip'],
            'mac' => AuditDevice::normalizeMac($host['mac'] ?? null),
            'hostname' => $this->shortString($host['hostname'] ?? null, 255),
            'vendor' => $this->shortString($host['vendor'] ?? null, 255),
            'kind' => $host['kind'] ?? null,
            'kind_hint' => $this->shortString($host['kind_hint'] ?? null, 255),
            'ports' => array_values(array_unique(array_map('intval', $host['ports'] ?? []))),
            'rtt_ms' => $host['rtt_ms'] ?? null,
            'self' => ! empty($host['self']) ?: null,
            'gateway' => ! empty($host['gateway']) ?: null,
        ], fn ($value) => $value !== null && $value !== []))->values()->all();

        $scan = $audit->networkScans()->create([
            'technician_id' => Auth::id(),
            'machine_name' => $this->shortString($request->header('X-Diag-Machine'), 255),
            'subnet' => $data['subnet'] ?? null,
            'local_ip' => $data['local_ip'] ?? null,
            'gateway' => $data['gateway'] ?? null,
            'dns' => $data['dns'] ?? null,
            // the site sees the client's public address, unless it runs on the same network
            'public_ip' => $data['public_ip']
                ?? (filter_var($request->ip(), FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) ?: null),
            'duration_ms' => $data['duration_ms'] ?? null,
            'host_count' => count($hosts),
            'hosts' => $hosts,
        ]);

        $added = 0;
        if ($request->boolean('add_devices')) {
            foreach ($hosts as $host) {
                [, $created] = $this->deviceFromHost($audit, $host);
                $added += $created ? 1 : 0;
            }
        }
        $this->markInProgress($audit);

        return response()->json([
            'id' => $scan->id,
            'host_count' => $scan->host_count,
            'devices_added' => $added,
            'audit_url' => route('audits.show', $audit),
        ], 201);
    }

    /**
     * Diagnostic of one PC of the audit, sent as the Diag Atelier's « Envoyer
     * au ticket » sends it. The device of the audit is the one given, else the
     * one with this serial number or PC name, else it is created.
     */
    public function apiStoreDiagnostic(Request $request, Audit $audit): JsonResponse
    {
        $extra = $request->validate([
            'audit_device_id' => 'nullable|integer|min:1',
            'kind' => ['nullable', Rule::in(AuditDevice::DIAGNOSABLE)],
            'location' => 'nullable|string|max:255',
            'assigned_to' => 'nullable|string|max:255',
            'ip' => 'nullable|ip',
            'mac' => 'nullable|string|max:20',
        ]);

        $given = null;
        if (! empty($extra['audit_device_id'])) {
            $given = $audit->devices()->find($extra['audit_device_id'])
                ?? throw ValidationException::withMessages(['audit_device_id' => 'Cet appareil n\'est plus dans l\'audit.']);
        }

        [$diagnostic, $inventory] = $this->createFromRequest($request, null);

        $serial = $inventory['serial'] ?? null;
        $machine = $diagnostic->machine_name;
        $mac = AuditDevice::normalizeMac($extra['mac'] ?? null);
        $hostname = $this->shortString($request->header('X-Diag-Machine'), 255);

        $auditDevice = $given
            ?? ($serial ? $audit->devices()->where('serial_number', $serial)->first() : null)
            ?? ($mac ? $audit->devices()->where('mac', $mac)->first() : null)
            ?? ($hostname ? $audit->devices()->where(fn ($q) => $q->where('hostname', $hostname)->orWhere('hostname', 'like', $hostname.'.%'))->first() : null)
            ?? new AuditDevice([
                'audit_id' => $audit->id,
                'kind' => $extra['kind'] ?? 'computer',
                'name' => $hostname ?: ($machine ?: 'PC'),
                'source' => 'diag',
            ]);

        $auditDevice->fill(array_filter([
            'kind' => $extra['kind'] ?? null,
            'location' => $extra['location'] ?? null,
            'assigned_to' => $extra['assigned_to'] ?? null,
            'ip' => $extra['ip'] ?? null,
            'mac' => $mac,
            'hostname' => $auditDevice->hostname ?: $hostname,
        ], fn ($value) => $value !== null && $value !== ''));
        // PC2 Diag ran on it: a host the scan could not identify is a computer
        if (! in_array($auditDevice->kind, AuditDevice::DIAGNOSABLE, true)) {
            $auditDevice->kind = 'computer';
        }
        $auditDevice->save();

        $sync = $this->recordOnAudit($audit, $auditDevice, $diagnostic, $inventory);

        return response()->json($this->auditResult($audit, $auditDevice, $diagnostic, $sync, true), 201);
    }
}
