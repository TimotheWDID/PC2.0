<?php

namespace App\Http\Controllers;

use App\Models\Audit;
use App\Models\AuditDevice;
use App\Models\AuditNetworkScan;
use App\Models\Device;
use App\Models\DeviceEvent;
use App\Models\Diagnostic;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Audits of a whole client (company or person): the network scans sent by
 * PC2 Diag, the devices of the audit and the diagnostic of each computer,
 * sent by PC2 Diag or made in the Diag Atelier like on a ticket.
 */
class AuditController extends DiagnosticController
{
    public function index(Request $request): InertiaResponse
    {
        $query = Audit::query()
            ->with(['client:id,client_type,company_name,first_name,last_name,email', 'technician:id,first_name,last_name'])
            ->withCount([
                'devices',
                'devices as diagnosed_count' => fn ($q) => $q->where('status', 'done'),
                'devices as todo_count' => fn ($q) => $q->where('status', 'todo')->whereIn('kind', AuditDevice::DIAGNOSABLE),
                'networkScans',
            ]);

        $search = trim((string) $request->query('q', ''));
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', '%'.$search.'%')
                    ->orWhere('site_name', 'like', '%'.$search.'%')
                    ->orWhereHas('client', fn ($c) => $c->where('company_name', 'like', '%'.$search.'%')
                        ->orWhere('first_name', 'like', '%'.$search.'%')
                        ->orWhere('last_name', 'like', '%'.$search.'%')
                        ->orWhere('email', 'like', '%'.$search.'%'));
            });
        }

        $status = trim((string) $request->query('status', ''));
        if (in_array($status, Audit::STATUSES, true)) {
            $query->where('status', $status);
        }

        $audits = $query
            ->orderByRaw("CASE status WHEN 'in_progress' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END")
            ->orderByDesc('updated_at')
            ->limit(300)
            ->get()
            ->map(fn (Audit $audit) => [
                ...$this->presentAudit($audit),
                'devices_count' => $audit->devices_count,
                'diagnosed_count' => $audit->diagnosed_count,
                'todo_count' => $audit->todo_count,
                'network_scans_count' => $audit->network_scans_count,
            ]);

        return Inertia::render('Audits/Index', [
            'audits' => $audits,
            'clients' => User::query()
                ->whereDoesntHave('agent')
                ->orderByRaw("CASE client_type WHEN 'company' THEN 0 ELSE 1 END")
                ->orderBy('company_name')
                ->orderBy('last_name')
                ->orderBy('first_name')
                ->get(['id', 'client_type', 'company_name', 'first_name', 'last_name', 'email'])
                ->map(fn (User $client) => [
                    'id' => $client->id,
                    'name' => $client->name,
                    'client_type' => $client->client_type ?? User::TYPE_PERSON,
                    'email' => $client->email,
                ]),
            'statuses' => Audit::STATUS_LABELS,
            'filters' => ['q' => $search, 'status' => $status],
            'defaultClientId' => $request->integer('client') ?: null,
        ]);
    }

    public function storeAudit(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', Rule::exists('users', 'id')],
            'title' => 'required|string|max:255',
            'site_name' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:20000',
        ]);

        $audit = Audit::create([...$data, 'technician_id' => Auth::id(), 'status' => 'draft']);

        return redirect()->route('audits.show', $audit)->with('success', 'Audit créé. Lancez PC2 Diag sur les PC du client et choisissez cet audit.');
    }

    public function showAudit(Audit $audit): InertiaResponse
    {
        $audit->load(['client', 'technician:id,first_name,last_name']);

        $devices = $audit->devices()
            ->with(['device:id,brand,model,serial_number,device_type', 'latestDiagnostic.technician:id,first_name,last_name'])
            ->withCount('diagnostics')
            ->orderByRaw("CASE status WHEN 'todo' THEN 1 WHEN 'done' THEN 2 ELSE 3 END")
            ->orderBy('name')
            ->get()
            ->map(fn (AuditDevice $device) => $this->presentDevice($audit, $device));

        $scans = $audit->networkScans()
            ->with('technician:id,first_name,last_name')
            ->latest()
            ->get()
            ->map(fn (AuditNetworkScan $scan) => [
                'id' => $scan->id,
                'created_at' => $scan->created_at?->toIso8601String(),
                'technician' => $scan->technician?->name,
                'machine_name' => $scan->machine_name,
                'subnet' => $scan->subnet,
                'local_ip' => $scan->local_ip,
                'gateway' => $scan->gateway,
                'dns' => $scan->dns,
                'public_ip' => $scan->public_ip,
                'duration_ms' => $scan->duration_ms,
                'host_count' => $scan->host_count,
                'hosts' => array_values($scan->hosts ?? []),
            ]);

        $client = $audit->client;

        return Inertia::render('Audits/Show', [
            'audit' => [
                ...$this->presentAudit($audit),
                'notes' => $audit->notes,
                'report_url' => route('audits.report', $audit, false),
            ],
            'client' => $client ? [
                'id' => $client->id,
                'name' => $client->name,
                'client_type' => $client->client_type ?? User::TYPE_PERSON,
                'email' => $client->email,
                'phone' => $client->phone,
                'url' => route('users.show-page', $client, false),
            ] : null,
            'devices' => $devices,
            'scans' => $scans,
            'kinds' => AuditDevice::KINDS,
            'deviceStatuses' => AuditDevice::STATUSES,
            'statuses' => Audit::STATUS_LABELS,
            'clientDevices' => $client ? $client->devices()
                ->orderBy('brand')->orderBy('model')
                ->get(['id', 'brand', 'model', 'serial_number', 'device_type'])
                ->map(fn (Device $device) => ['id' => $device->id, 'name' => $device->display_name]) : [],
        ]);
    }

    public function updateAudit(Request $request, Audit $audit): RedirectResponse
    {
        $data = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'status' => ['sometimes', 'required', Rule::in(Audit::STATUSES)],
            'site_name' => 'sometimes|nullable|string|max:255',
            'notes' => 'sometimes|nullable|string|max:20000',
        ]);

        $audit->update($data);

        return back()->with('success', 'Audit mis à jour.');
    }

    public function destroyAudit(Audit $audit): RedirectResponse
    {
        $audit->delete();

        return redirect()->route('audits.index')->with('success', 'Audit supprimé.');
    }

    public function storeDevice(Request $request, Audit $audit): RedirectResponse
    {
        $audit->devices()->create([...$this->validateDevice($request, $audit), 'source' => 'manual']);
        $this->markInProgress($audit);

        return back()->with('success', 'Appareil ajouté à l\'audit.');
    }

    public function updateDevice(Request $request, Audit $audit, AuditDevice $device): RedirectResponse
    {
        $this->ensureDeviceOfAudit($audit, $device);
        $device->update($this->validateDevice($request, $audit, true));

        return back()->with('success', 'Appareil mis à jour.');
    }

    public function destroyDevice(Audit $audit, AuditDevice $device): RedirectResponse
    {
        $this->ensureDeviceOfAudit($audit, $device);
        $device->diagnostics()->get()->each(
            fn (Diagnostic $diagnostic) => Storage::disk('local')->deleteDirectory($diagnostic->storageDirectory())
        );
        $device->delete();

        return back()->with('success', 'Appareil retiré de l\'audit.');
    }

    /**
     * Turns hosts of a network scan into devices of the audit; a host already
     * in the audit (same MAC, else same IP) is updated instead.
     */
    public function addHosts(Request $request, Audit $audit, AuditNetworkScan $scan): RedirectResponse
    {
        abort_unless((int) $scan->audit_id === (int) $audit->id, 404);
        $ips = $request->validate(['ips' => 'required|array|min:1', 'ips.*' => 'string|max:45'])['ips'];

        $added = 0;
        foreach ($scan->hosts ?? [] as $host) {
            if (! is_array($host) || ! in_array($host['ip'] ?? null, $ips, true)) {
                continue;
            }
            [, $created] = $this->deviceFromHost($audit, $host);
            $added += $created ? 1 : 0;
        }
        $this->markInProgress($audit);

        $count = count($ips);

        return back()->with('success', $added === $count
            ? "{$added} équipement(s) ajouté(s) à l'audit."
            : "{$added} équipement(s) ajouté(s), ".($count - $added).' déjà présent(s) mis à jour.');
    }

    public function destroyScan(Audit $audit, AuditNetworkScan $scan): RedirectResponse
    {
        abort_unless((int) $scan->audit_id === (int) $audit->id, 404);
        $scan->delete();

        return back()->with('success', 'Scan réseau supprimé.');
    }

    /**
     * The Diag Atelier for one device of the audit (HWiNFO, battery report or
     * PC2 Diag analysis dropped by hand), its report saved on the audit.
     */
    public function deviceTool(Audit $audit, AuditDevice $device): Response
    {
        $this->ensureDeviceOfAudit($audit, $device);

        return $this->renderAuditTool($audit, $device);
    }

    public function storeDeviceDiagnostic(Request $request, Audit $audit, AuditDevice $device): JsonResponse
    {
        $this->ensureDeviceOfAudit($audit, $device);
        [$diagnostic, $inventory] = $this->createFromRequest($request, null);
        $sync = $this->recordOnAudit($audit, $device, $diagnostic, $inventory);

        return response()->json($this->auditResult($audit, $device, $diagnostic, $sync, false), 201);
    }

    public function showDiagnostic(Audit $audit, Diagnostic $diagnostic): Response
    {
        $device = $this->deviceOfDiagnostic($audit, $diagnostic);
        $diagnostic->loadMissing('technician:id,first_name,last_name');

        if ($this->isAppReport($diagnostic)) {
            return $this->renderAppReport($diagnostic, route('audits.show', $audit, false), 'Audit');
        }

        $files = collect($diagnostic->files ?? [])->map(fn (array $file) => [
            'source' => $file['source'],
            'name' => $file['name'],
            'encoding' => $file['encoding'],
            'url' => route('audits.diagnostics.file', [$audit, $diagnostic, $file['source']], false),
        ])->values()->all();

        return $this->renderAuditTool($audit, $device, [
            'id' => $diagnostic->id,
            'created_at' => $diagnostic->created_at?->toIso8601String(),
            'technician' => $this->technicianName($diagnostic),
            'files' => $files,
            'state' => $diagnostic->state ?? (object) [],
        ]);
    }

    public function diagnosticFile(Audit $audit, Diagnostic $diagnostic, string $source): StreamedResponse
    {
        $this->deviceOfDiagnostic($audit, $diagnostic);

        $file = collect($diagnostic->files ?? [])->firstWhere('source', $source);
        abort_unless($file && Storage::disk('local')->exists($file['path']), 404);

        return Storage::disk('local')->response($file['path'], null, [
            'Content-Type' => 'application/octet-stream',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    public function destroyDiagnostic(Audit $audit, Diagnostic $diagnostic): RedirectResponse
    {
        $device = $this->deviceOfDiagnostic($audit, $diagnostic);
        Storage::disk('local')->deleteDirectory($diagnostic->storageDirectory());
        $diagnostic->delete();

        if (! $device->diagnostics()->exists() && $device->status === 'done') {
            $device->update(['status' => 'todo']);
        }

        return back()->with('success', 'Diagnostic supprimé.');
    }

    /**
     * The audit report for the client: summary, network and every device
     * with the verdict and advice of its diagnostic, printable as PDF.
     */
    public function report(Audit $audit): Response
    {
        $audit->load(['client', 'technician:id,first_name,last_name']);
        $devices = $audit->devices()->with('latestDiagnostic')->orderBy('kind')->orderBy('name')->get();
        $scan = $audit->networkScans()->latest()->first();

        $rows = $devices->map(function (AuditDevice $device) {
            $diagnostic = $device->latestDiagnostic;
            $client = is_array($diagnostic?->report['clientReport'] ?? null) ? $diagnostic->report['clientReport'] : [];
            $advice = collect(is_array($client['advice'] ?? null) ? $client['advice'] : [])
                ->filter(fn ($item) => is_array($item) && is_string($item['title'] ?? null) && trim($item['title']) !== '')
                ->map(fn (array $item) => [
                    'priority' => in_array($item['priority'] ?? null, ['urgent', 'reco', 'option', 'info'], true) ? $item['priority'] : 'info',
                    'title' => trim(strip_tags($item['title'])),
                ])->take(5)->values()->all();

            return [
                'kind' => AuditDevice::KINDS[$device->kind] ?? $device->kind,
                'diagnosable' => in_array($device->kind, AuditDevice::DIAGNOSABLE, true),
                'name' => $device->name,
                'ip' => $device->ip,
                'location' => $device->location,
                'assigned_to' => $device->assigned_to,
                'machine' => trim(strip_tags((string) ($diagnostic?->report['machine']['name'] ?? $diagnostic?->machine_name ?? ''))),
                'overall' => in_array($diagnostic?->overall, ['good', 'warn', 'crit'], true) ? $diagnostic->overall : null,
                'overall_label' => $diagnostic?->overall_label,
                'score' => $diagnostic?->viability_score,
                'viability_label' => $diagnostic?->viability_label,
                'advice' => $advice,
                'notes' => $device->notes,
            ];
        });

        return response()->view('audits.report', [
            'audit' => $audit,
            'statusLabel' => Audit::STATUS_LABELS[$audit->status] ?? $audit->status,
            'shopName' => (string) config('app.name'),
            'date' => now()->timezone('Europe/Paris')->locale('fr')->translatedFormat('j F Y'),
            'rows' => $rows,
            'scan' => $scan,
            'counts' => [
                'devices' => $devices->count(),
                'diagnosed' => $devices->filter(fn ($d) => $d->latestDiagnostic)->count(),
                'crit' => $rows->where('overall', 'crit')->count(),
                'warn' => $rows->where('overall', 'warn')->count(),
                'good' => $rows->where('overall', 'good')->count(),
            ],
        ], 200, ['Cache-Control' => 'no-store']);
    }

    // ------------------------------------------------------------ shared with the PC2 Diag API

    protected function presentAudit(Audit $audit): array
    {
        return [
            'id' => $audit->id,
            'title' => $audit->title,
            'status' => $audit->status,
            'status_label' => Audit::STATUS_LABELS[$audit->status] ?? $audit->status,
            'site_name' => $audit->site_name,
            'client' => $audit->client ? [
                'id' => $audit->client->id,
                'name' => $audit->client->name,
                'client_type' => $audit->client->client_type ?? User::TYPE_PERSON,
            ] : null,
            'technician' => $audit->technician?->name,
            'created_at' => $audit->created_at?->toIso8601String(),
            'updated_at' => $audit->updated_at?->toIso8601String(),
            'completed_at' => $audit->completed_at?->toIso8601String(),
            'url' => route('audits.show', $audit, false),
        ];
    }

    protected function presentDevice(Audit $audit, AuditDevice $device): array
    {
        $diagnostic = $device->latestDiagnostic;

        return [
            'id' => $device->id,
            'kind' => $device->kind,
            'kind_label' => AuditDevice::KINDS[$device->kind] ?? $device->kind,
            'name' => $device->name,
            'hostname' => $device->hostname,
            'ip' => $device->ip,
            'mac' => $device->mac,
            'serial_number' => $device->serial_number,
            'location' => $device->location,
            'assigned_to' => $device->assigned_to,
            'status' => $device->status,
            'source' => $device->source,
            'open_ports' => $device->open_ports ?? [],
            'notes' => $device->notes,
            'diagnosable' => in_array($device->kind, AuditDevice::DIAGNOSABLE, true),
            'diagnostics_count' => $device->diagnostics_count ?? null,
            'device' => $device->device ? [
                'id' => $device->device->id,
                'name' => $device->device->display_name,
                'url' => route('devices.show', $device->device, false),
            ] : null,
            'diagnostic' => $diagnostic ? [
                'id' => $diagnostic->id,
                'created_at' => $diagnostic->created_at?->toIso8601String(),
                'technician' => $this->technicianName($diagnostic),
                'machine_name' => $diagnostic->machine_name,
                'overall' => $diagnostic->overall,
                'overall_label' => $diagnostic->overall_label,
                'viability_score' => $diagnostic->viability_score,
                'viability_level' => $diagnostic->viability_level,
                'viability_label' => $diagnostic->viability_label,
                'report_url' => route('audits.diagnostics.show', [$audit, $diagnostic], false),
            ] : null,
            'tool_url' => route('audits.devices.diag', [$audit, $device], false),
        ];
    }

    /**
     * Puts a saved diagnostic on a device of the audit: the inventory sheet
     * fills the client's device (found by serial number, else created), and
     * the device history logs it.
     */
    protected function recordOnAudit(Audit $audit, AuditDevice $auditDevice, Diagnostic $diagnostic, array $inventory): array
    {
        $warnings = [];
        $created = false;
        $filled = [];
        $conflicts = [];
        $device = $auditDevice->device;
        $serial = $inventory['serial'] ?? null;

        if (! $device && $serial) {
            $existing = Device::query()->where('serial_number', $serial)->first();
            if ($existing && (int) $existing->user_id === (int) $audit->user_id) {
                $device = $existing;
            } elseif ($existing) {
                $warnings[] = "Le numéro de série « {$serial} » appartient à l'appareil d'un autre client : la fiche appareil n'a pas été liée.";
                unset($inventory['serial']);
            }
        }

        if (! $device && $inventory && $audit->user_id) {
            $device = new Device([
                'user_id' => $audit->user_id,
                'device_type' => 'computer',
                'status' => 'active',
            ]);
            $created = true;
        }

        if ($device) {
            [$filled, $conflicts] = $this->fillDevice($device, $inventory, $warnings);
        }

        $auditDevice->fill(array_filter([
            'device_id' => $device?->id,
            'serial_number' => $auditDevice->serial_number ?: ($inventory['serial'] ?? null),
            'hostname' => $auditDevice->hostname ?: $diagnostic->machine_name,
            'status' => 'done',
        ], fn ($value) => $value !== null));
        if (! $auditDevice->name || $auditDevice->name === $auditDevice->hostname) {
            $model = trim(($inventory['brand'] ?? '').' '.($inventory['model'] ?? ''));
            $auditDevice->name = $diagnostic->machine_name ?: ($model !== '' ? $model : $auditDevice->name);
        }
        $auditDevice->save();

        $diagnostic->audit_device_id = $auditDevice->id;
        $diagnostic->device_id = $device?->id;
        $diagnostic->save();

        if ($device) {
            $tool = $this->isAppReport($diagnostic) || ! empty($diagnostic->report['sources']['app']) ? 'PC2 Diag' : 'Diag Atelier';
            DeviceEvent::create([
                'device_id' => $device->id,
                'technician_id' => Auth::id(),
                'event_type' => 'diagnostic',
                'summary' => mb_substr('Diagnostic '.$tool.' (audit « '.$audit->title.' »)'.($diagnostic->overall_label ? ' : '.$diagnostic->overall_label : ''), 0, 500),
                'details' => array_filter([
                    'diagnostic_id' => $diagnostic->id,
                    'audit_id' => $audit->id,
                    'note' => $this->diagnosticNote($diagnostic),
                ]),
                'happened_at' => now(),
            ]);
        }

        $this->markInProgress($audit);

        return ['device' => $device, 'created' => $created, 'filled' => $filled, 'conflicts' => $conflicts, 'warnings' => $warnings];
    }

    protected function auditResult(Audit $audit, AuditDevice $auditDevice, Diagnostic $diagnostic, array $sync, bool $absolute): array
    {
        $device = $sync['device'];

        return [
            'id' => $diagnostic->id,
            'audit' => ['id' => $audit->id, 'title' => $audit->title],
            'audit_device' => ['id' => $auditDevice->id, 'name' => $auditDevice->name],
            'report_url' => route('audits.diagnostics.show', [$audit, $diagnostic], $absolute),
            'audit_url' => route('audits.show', $audit, $absolute),
            'device' => $device ? ['id' => $device->id, 'name' => $device->display_name] : null,
            'device_created' => $sync['created'],
            'filled' => $sync['filled'],
            'conflicts' => $sync['conflicts'],
            'warnings' => $sync['warnings'],
        ];
    }

    /**
     * The device of the audit matching a host of a scan (same MAC, else same
     * IP), updated with what the scan saw, or created.
     *
     * @return array{0: AuditDevice, 1: bool}
     */
    protected function deviceFromHost(Audit $audit, array $host): array
    {
        $mac = AuditDevice::normalizeMac($host['mac'] ?? null);
        $ip = $this->shortString($host['ip'] ?? null, 45);
        $hostname = $this->shortString($host['hostname'] ?? null, 255);

        $device = ($mac ? $audit->devices()->where('mac', $mac)->first() : null)
            ?? ($ip ? $audit->devices()->where('ip', $ip)->first() : null);
        $created = ! $device;

        $device ??= new AuditDevice([
            'audit_id' => $audit->id,
            'kind' => array_key_exists($host['kind'] ?? '', AuditDevice::KINDS) ? $host['kind'] : 'other',
            'name' => $hostname ? explode('.', $hostname)[0] : ($this->shortString($host['vendor'] ?? null, 200) ?? $ip ?? 'Équipement'),
            'source' => 'scan',
            'status' => 'todo',
        ]);

        $device->fill(array_filter([
            'ip' => $ip,
            'mac' => $mac,
            'hostname' => $device->hostname ?: $hostname,
            'open_ports' => array_values(array_filter(array_map('intval', is_array($host['ports'] ?? null) ? $host['ports'] : []))) ?: null,
        ], fn ($value) => $value !== null));
        $device->save();

        return [$device, $created];
    }

    protected function markInProgress(Audit $audit): void
    {
        if ($audit->status === 'draft') {
            $audit->update(['status' => 'in_progress']);
        } else {
            $audit->touch();
        }
    }

    private function validateDevice(Request $request, Audit $audit, bool $partial = false): array
    {
        $req = $partial ? 'sometimes|required' : 'required';
        $data = $request->validate([
            'kind' => [$partial ? 'sometimes' : 'required', Rule::in(array_keys(AuditDevice::KINDS))],
            'name' => $req.'|string|max:255',
            'hostname' => 'sometimes|nullable|string|max:255',
            'ip' => 'sometimes|nullable|ip',
            'mac' => 'sometimes|nullable|string|max:20',
            'serial_number' => 'sometimes|nullable|string|max:255',
            'location' => 'sometimes|nullable|string|max:255',
            'assigned_to' => 'sometimes|nullable|string|max:255',
            'status' => ['sometimes', Rule::in(array_keys(AuditDevice::STATUSES))],
            'notes' => 'sometimes|nullable|string|max:5000',
            'device_id' => ['sometimes', 'nullable', 'integer', Rule::exists('devices', 'id')->where('user_id', $audit->user_id)],
        ]);

        if (array_key_exists('mac', $data)) {
            $data['mac'] = AuditDevice::normalizeMac($data['mac']);
        }

        return $data;
    }

    private function ensureDeviceOfAudit(Audit $audit, AuditDevice $device): void
    {
        abort_unless((int) $device->audit_id === (int) $audit->id, 404);
    }

    private function deviceOfDiagnostic(Audit $audit, Diagnostic $diagnostic): AuditDevice
    {
        $device = $diagnostic->auditDevice;
        abort_unless($device && (int) $device->audit_id === (int) $audit->id, 404);

        return $device;
    }

    private function renderAuditTool(Audit $audit, AuditDevice $device, ?array $preload = null): Response
    {
        $audit->loadMissing('client');

        return $this->renderDiag([
            'ticket' => null,
            'audit' => [
                'id' => $audit->id,
                'title' => $audit->title,
                'client' => $audit->client?->name,
                'device' => $device->name,
                'url' => route('audits.show', $audit, false),
            ],
            'device' => $device->device ? ['id' => $device->device->id, 'name' => $device->device->display_name] : null,
            'storeUrl' => route('audits.devices.diagnostics.store', [$audit, $device], false),
            'preload' => $preload,
        ]);
    }
}
