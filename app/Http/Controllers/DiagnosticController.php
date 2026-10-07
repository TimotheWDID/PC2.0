<?php

namespace App\Http\Controllers;

use App\Models\Device;
use App\Models\DeviceEvent;
use App\Models\Diagnostic;
use App\Models\Ticket;
use App\Models\TicketTimelineEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Diag Atelier inside the ticket system: serves the diagnostic tool for a
 * ticket, stores the reports it sends back and fills the ticket's device
 * from the tool's "Fiche inventaire".
 */
class DiagnosticController extends Controller
{
    /**
     * Diag inventory field id => [devices column, label, kind, max length].
     */
    private const INVENTORY_FIELDS = [
        'brand' => ['brand', 'Marque', 'string', 255],
        'model' => ['model', 'Modèle', 'string', 255],
        'serial' => ['serial_number', 'Numéro de série', 'string', 255],
        'tracking' => ['asset_tag', 'Numéro de suivi', 'string', 255],
        'purchase' => ['purchase_date', "Date d'achat", 'date', null],
        'warrantyStart' => ['warranty_start_date', 'Début garantie', 'date', null],
        'warrantyEnd' => ['warranty_end_date', 'Fin garantie', 'date', null],
        'supplier' => ['vendor_name', 'Fournisseur', 'string', 255],
        'imei' => ['imei', 'IMEI', 'string', 30],
        'sim' => ['sim_number', 'Numéro SIM', 'string', 50],
        'phone' => ['phone_number', 'Téléphone', 'string', 50],
        'os' => ['os_name', 'OS', 'string', 100],
        'ram' => ['ram_gb', 'RAM (Go)', 'int', null],
        'storage' => ['storage_gb', 'Stockage (Go)', 'int', null],
        'cpu' => ['cpu', 'CPU', 'string', 120],
        'notes' => ['notes', 'Notes', 'text', 5000],
    ];

    /** Columns with a unique index on devices. */
    private const UNIQUE_COLUMNS = ['serial_number', 'asset_tag', 'imei'];

    private const SOURCES = ['aida', 'hwinfo', 'battery'];

    /**
     * The Diag page, opened from a ticket, ready to send its report back.
     */
    public function tool(Ticket $ticket): Response
    {
        return $this->renderTool($ticket);
    }

    /**
     * A saved diagnostic reopened in the Diag, from the files it was built from.
     */
    public function show(Ticket $ticket, Diagnostic $diagnostic): Response
    {
        $this->ensureBelongsToTicket($ticket, $diagnostic);
        $diagnostic->loadMissing('technician:id,first_name,last_name');

        $files = collect($diagnostic->files ?? [])->map(fn (array $file) => [
            'source' => $file['source'],
            'name' => $file['name'],
            'encoding' => $file['encoding'],
            'url' => route('tickets.diagnostics.file', [$ticket, $diagnostic, $file['source']], false),
        ])->values()->all();

        return $this->renderTool($ticket, [
            'id' => $diagnostic->id,
            'created_at' => $diagnostic->created_at?->toIso8601String(),
            'technician' => $this->technicianName($diagnostic),
            'files' => $files,
            'state' => $diagnostic->state ?? (object) [],
        ]);
    }

    /**
     * One of the raw export files a diagnostic was built from.
     */
    public function file(Ticket $ticket, Diagnostic $diagnostic, string $source): StreamedResponse
    {
        $this->ensureBelongsToTicket($ticket, $diagnostic);

        $file = collect($diagnostic->files ?? [])->firstWhere('source', $source);
        abort_unless($file && Storage::disk('local')->exists($file['path']), 404);

        return Storage::disk('local')->response($file['path'], null, [
            'Content-Type' => 'application/octet-stream',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    /**
     * Report sent by the Diag: saved on the ticket, logged on the device,
     * and the inventory sheet fills the device's empty fields.
     */
    public function store(Request $request, Ticket $ticket): JsonResponse
    {
        $data = $request->validate([
            'report' => 'required|json|max:3000000',
            'inventory' => 'nullable|json|max:20000',
            'state' => 'nullable|json|max:50000',
            'files' => 'nullable|array|max:3',
            'files.*' => 'file|max:51200',
            'file_sources' => 'nullable|array|max:3',
            'file_sources.*' => 'string|in:'.implode(',', self::SOURCES),
            'file_names' => 'nullable|array|max:3',
            'file_names.*' => 'nullable|string|max:255',
            'file_encodings' => 'nullable|array|max:3',
            'file_encodings.*' => 'string|in:gzip,plain',
        ]);

        $report = json_decode($data['report'], true);
        if (! is_array($report)) {
            throw ValidationException::withMessages(['report' => 'Rapport illisible.']);
        }
        $inventory = $this->normalizeInventory(json_decode($data['inventory'] ?? 'null', true));
        $state = json_decode($data['state'] ?? 'null', true);

        $user = Auth::user();
        $machine = is_array($report['machine'] ?? null) ? $report['machine'] : [];
        $status = is_array($report['status'] ?? null) ? $report['status'] : [];
        $viability = is_array($report['viability'] ?? null) ? $report['viability'] : [];

        $diagnostic = Diagnostic::create([
            'ticket_id' => $ticket->id,
            'device_id' => $ticket->device_id,
            'technician_id' => $user?->id,
            'machine_name' => $this->shortString($machine['name'] ?? null, 255),
            'overall' => $this->shortString($status['overall'] ?? null, 20),
            'overall_label' => $this->shortString($status['overallLabel'] ?? null, 255),
            'viability_score' => isset($viability['score']) && is_numeric($viability['score'])
                ? max(0, min(100, (int) round($viability['score'])))
                : null,
            'viability_level' => $this->shortString($viability['level'] ?? null, 20),
            'viability_label' => $this->shortString($viability['verdict'] ?? null, 255),
            'report' => $report,
            'inventory' => $inventory ?: null,
            'state' => is_array($state) ? $state : null,
        ]);

        $diagnostic->files = $this->storeFiles($request, $diagnostic);

        $sync = $inventory
            ? $this->syncInventoryToDevice($ticket, $inventory)
            : ['device' => $ticket->device, 'created' => false, 'filled' => [], 'conflicts' => [], 'warnings' => []];

        $device = $sync['device'];
        $diagnostic->device_id = $device?->id;
        $diagnostic->save();

        $summary = 'Diagnostic Diag Atelier'.($diagnostic->overall_label ? ' : '.$diagnostic->overall_label : '');

        if ($device) {
            DeviceEvent::create([
                'device_id' => $device->id,
                'ticket_id' => $ticket->id,
                'technician_id' => $user?->id,
                'event_type' => 'diagnostic',
                'summary' => mb_substr($summary, 0, 500),
                'details' => array_filter([
                    'diagnostic_id' => $diagnostic->id,
                    'note' => $this->diagnosticNote($diagnostic),
                ]),
                'happened_at' => now(),
            ]);
        }

        TicketTimelineEvent::create([
            'ticket_id' => $ticket->id,
            'technician_id' => $user?->id,
            'event_type' => 'diagnostic_added',
            'summary' => $summary,
            'details' => array_filter([
                'diagnostic_id' => $diagnostic->id,
                'overall' => $diagnostic->overall,
                'viability_score' => $diagnostic->viability_score,
                'device_id' => $device?->id,
                'device_created' => $sync['created'] ?: null,
            ], fn ($value) => ! is_null($value)),
            'happened_at' => now(),
        ]);

        return response()->json([
            'id' => $diagnostic->id,
            'ticket_url' => route('tickets.show', $ticket, false),
            'report_url' => route('tickets.diagnostics.show', [$ticket, $diagnostic], false),
            'inventory_url' => route('tickets.diagnostics.inventory', [$ticket, $diagnostic], false),
            'device' => $device ? ['id' => $device->id, 'name' => $device->display_name] : null,
            'device_created' => $sync['created'],
            'filled' => $sync['filled'],
            'conflicts' => $sync['conflicts'],
            'warnings' => $sync['warnings'],
        ], 201);
    }

    /**
     * Overwrite device fields that differed, once the technician confirmed them.
     */
    public function applyInventory(Request $request, Ticket $ticket, Diagnostic $diagnostic): JsonResponse
    {
        $this->ensureBelongsToTicket($ticket, $diagnostic);

        $data = $request->validate([
            'fields' => 'required|array|min:1',
            'fields.*' => 'string|in:'.implode(',', array_keys(self::INVENTORY_FIELDS)),
        ]);

        $device = $ticket->device;
        if (! $device) {
            throw ValidationException::withMessages(['device' => 'Aucun appareil n\'est associe a ce ticket.']);
        }

        $inventory = $diagnostic->inventory ?? [];
        $updated = [];
        $warnings = [];

        foreach (array_unique($data['fields']) as $field) {
            if (! array_key_exists($field, $inventory)) {
                continue;
            }

            [$column, $label] = self::INVENTORY_FIELDS[$field];
            $value = $inventory[$field];

            if ($this->isTakenByAnotherDevice($column, $value, $device->id)) {
                $warnings[] = "{$label} « {$value} » est déjà utilisé par un autre appareil : non modifié.";

                continue;
            }

            $device->{$column} = $value;
            $updated[] = $field;
        }

        $device->save();

        return response()->json([
            'updated' => $updated,
            'warnings' => $warnings,
        ]);
    }

    public function destroy(Ticket $ticket, Diagnostic $diagnostic)
    {
        $this->ensureBelongsToTicket($ticket, $diagnostic);

        Storage::disk('local')->deleteDirectory($diagnostic->storageDirectory());
        DeviceEvent::query()
            ->where('event_type', 'diagnostic')
            ->where('ticket_id', $ticket->id)
            ->where('details->diagnostic_id', $diagnostic->id)
            ->delete();
        $diagnostic->delete();

        return back()->with('success', 'Diagnostic supprimé.');
    }

    private function renderTool(Ticket $ticket, ?array $preload = null): Response
    {
        $path = resource_path('diag/diag-atelier.html');
        abort_unless(is_file($path), 404, 'Diag Atelier introuvable.');

        $ticket->loadMissing(['user', 'device']);

        $config = [
            'ticket' => [
                'id' => $ticket->id,
                'title' => $ticket->title,
                'client' => $ticket->user ? trim(($ticket->user->first_name ?? '').' '.($ticket->user->last_name ?? '')) : null,
                'url' => route('tickets.show', $ticket, false),
            ],
            'device' => $ticket->device ? [
                'id' => $ticket->device->id,
                'name' => $ticket->device->display_name,
            ] : null,
            'storeUrl' => route('tickets.diagnostics.store', $ticket, false),
            'csrf' => csrf_token(),
            'preload' => $preload,
        ];

        $json = json_encode($config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $html = file_get_contents($path);
        $html = preg_replace('~</head>~i', "<script>window.DIAG_TICKET = {$json};</script>\n</head>", $html, 1);

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => 'no-store',
            'X-Frame-Options' => 'SAMEORIGIN',
        ]);
    }

    private function ensureBelongsToTicket(Ticket $ticket, Diagnostic $diagnostic): void
    {
        abort_unless((int) $diagnostic->ticket_id === (int) $ticket->id, 404);
    }

    /**
     * @return array<int, array{source: string, name: string, encoding: string, path: string, size: int}>
     */
    private function storeFiles(Request $request, Diagnostic $diagnostic): array
    {
        $uploads = $request->file('files', []);
        $sources = $request->input('file_sources', []);
        $names = $request->input('file_names', []);
        $encodings = $request->input('file_encodings', []);
        $stored = [];

        foreach ($uploads as $index => $upload) {
            $source = $sources[$index] ?? null;
            if (! $source || isset($stored[$source])) {
                continue;
            }

            $encoding = ($encodings[$index] ?? 'plain') === 'gzip' ? 'gzip' : 'plain';
            $path = $upload->storeAs($diagnostic->storageDirectory(), $source.($encoding === 'gzip' ? '.txt.gz' : '.txt'), 'local');
            if (! $path) {
                continue;
            }

            $stored[$source] = [
                'source' => $source,
                'name' => mb_substr(basename((string) ($names[$index] ?? $upload->getClientOriginalName())), 0, 255),
                'encoding' => $encoding,
                'path' => $path,
                'size' => (int) $upload->getSize(),
            ];
        }

        return array_values($stored);
    }

    /**
     * Keeps the known inventory fields, cleaned to what the devices columns accept.
     *
     * @return array<string, string|int>
     */
    private function normalizeInventory(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        $clean = [];
        foreach (self::INVENTORY_FIELDS as $field => [, , $kind, $max]) {
            $value = $raw[$field] ?? null;
            if (! is_scalar($value)) {
                continue;
            }
            $value = trim((string) $value);
            if ($value === '') {
                continue;
            }

            if ($kind === 'int') {
                $digits = preg_replace('/[^\d]/', '', explode(',', str_replace('.', ',', $value))[0]);
                if ($digits === '' || (int) $digits <= 0) {
                    continue;
                }
                $clean[$field] = min(65535, (int) $digits);
            } elseif ($kind === 'date') {
                try {
                    $clean[$field] = Carbon::createFromFormat('!Y-m-d', $value)->format('Y-m-d');
                } catch (\Throwable) {
                    continue;
                }
            } else {
                $clean[$field] = mb_substr($value, 0, $max);
            }
        }

        return $clean;
    }

    /**
     * Fills the ticket's device from the inventory sheet, creating and
     * attaching one when the ticket has none. Fields that already hold a
     * different value are returned as conflicts, never overwritten here.
     */
    private function syncInventoryToDevice(Ticket $ticket, array $inventory): array
    {
        $device = $ticket->device;
        $created = false;
        $warnings = [];

        if (! $device && $ticket->user_id) {
            $serial = $inventory['serial'] ?? null;
            if ($serial) {
                $existing = Device::query()->where('serial_number', $serial)->first();
                if ($existing && (int) $existing->user_id === (int) $ticket->user_id) {
                    $device = $existing;
                } elseif ($existing) {
                    $warnings[] = "Le numéro de série « {$serial} » appartient à l'appareil d'un autre client : il n'a pas été repris.";
                    unset($inventory['serial']);
                }
            }

            if (! $device) {
                $device = new Device([
                    'user_id' => $ticket->user_id,
                    'device_type' => 'computer',
                    'status' => 'active',
                ]);
                $created = true;
            }
        }

        if (! $device) {
            return ['device' => null, 'created' => false, 'filled' => [], 'conflicts' => [], 'warnings' => $warnings];
        }

        $filled = [];
        $conflicts = [];

        foreach ($inventory as $field => $value) {
            [$column, $label] = self::INVENTORY_FIELDS[$field];
            $current = $this->currentValue($device, $column);

            if ($current === null || $current === '') {
                if ($this->isTakenByAnotherDevice($column, $value, $device->id)) {
                    $warnings[] = "{$label} « {$value} » est déjà utilisé par un autre appareil : non repris.";

                    continue;
                }
                $device->{$column} = $value;
                $filled[] = $field;
            } elseif ((string) $current !== (string) $value) {
                $conflicts[] = [
                    'field' => $field,
                    'label' => $label,
                    'current' => (string) $current,
                    'proposed' => (string) $value,
                ];
            }
        }

        $device->save();

        if ((int) $ticket->device_id !== (int) $device->id) {
            $ticket->device_id = $device->id;
            $ticket->save();
            $this->syncTicketPasswordToDevice($ticket, $device);

            TicketTimelineEvent::create([
                'ticket_id' => $ticket->id,
                'technician_id' => Auth::id(),
                'event_type' => 'device_attached',
                'summary' => $created ? 'Appareil cree depuis le Diag et lie au ticket' : 'Appareil lie au ticket depuis le Diag',
                'details' => ['device_id' => $device->id, 'device_name' => $device->display_name],
                'happened_at' => now(),
            ]);
        }

        return [
            'device' => $device,
            'created' => $created,
            'filled' => $filled,
            'conflicts' => $conflicts,
            'warnings' => $warnings,
        ];
    }

    private function currentValue(Device $device, string $column): string|int|null
    {
        $value = $device->{$column};

        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        return is_string($value) ? trim($value) : $value;
    }

    private function isTakenByAnotherDevice(string $column, mixed $value, ?int $deviceId): bool
    {
        if (! in_array($column, self::UNIQUE_COLUMNS, true)) {
            return false;
        }

        return Device::query()
            ->where($column, $value)
            ->when($deviceId, fn ($query) => $query->where('id', '!=', $deviceId))
            ->exists();
    }

    private function syncTicketPasswordToDevice(Ticket $ticket, Device $device): void
    {
        if (! empty($ticket->device_password)) {
            $device->access_password = $ticket->device_password;
            $device->no_access_password = false;
            $device->save();

            return;
        }

        if ($ticket->no_device_password) {
            $device->access_password = null;
            $device->no_access_password = true;
            $device->save();
        }
    }

    private function diagnosticNote(Diagnostic $diagnostic): ?string
    {
        $parts = array_filter([
            $diagnostic->machine_name,
            $diagnostic->viability_score !== null
                ? 'Viabilité '.$diagnostic->viability_score.'/100'.($diagnostic->viability_label ? ' ('.$diagnostic->viability_label.')' : '')
                : null,
        ]);

        return $parts ? implode(' - ', $parts) : null;
    }

    private function technicianName(Diagnostic $diagnostic): ?string
    {
        $technician = $diagnostic->technician;

        return $technician ? trim(($technician->first_name ?? '').' '.($technician->last_name ?? '')) : null;
    }

    private function shortString(mixed $value, int $max): ?string
    {
        if (! is_scalar($value)) {
            return null;
        }
        $value = trim((string) $value);

        return $value === '' ? null : mb_substr($value, 0, $max);
    }
}
