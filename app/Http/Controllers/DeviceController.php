<?php

namespace App\Http\Controllers;

use App\Models\Device;
use App\Models\DeviceEvent;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class DeviceController extends Controller
{
    private function canViewDevice(User $viewer, Device $device): bool
    {
        if ($viewer->agent) {
            return true;
        }

        return (int) $viewer->id === (int) $device->user_id;
    }

    public function index(Request $request)
    {
        $currentUser = Auth::user();
        if (!$currentUser) {
            abort(403, 'Acces non autorise.');
        }

        $query = Device::query()
            ->with(['user:id,first_name,last_name,email'])
            ->withCount('tickets')
            ->withMax('events', 'happened_at');

        if (!$currentUser->agent) {
            $query->where('user_id', $currentUser->id);
        }

        $search = trim((string) $request->query('q', ''));
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('id', 'like', '%' . $search . '%')
                    ->orWhere('brand', 'like', '%' . $search . '%')
                    ->orWhere('model', 'like', '%' . $search . '%')
                    ->orWhere('serial_number', 'like', '%' . $search . '%')
                    ->orWhere('asset_tag', 'like', '%' . $search . '%')
                    ->orWhere('imei', 'like', '%' . $search . '%')
                    ->orWhereHas('user', function ($userQuery) use ($search) {
                        $userQuery->where('first_name', 'like', '%' . $search . '%')
                            ->orWhere('last_name', 'like', '%' . $search . '%')
                            ->orWhere('email', 'like', '%' . $search . '%');
                    });
            });
        }

        $status = trim((string) $request->query('status', ''));
        if ($status !== '' && in_array($status, ['active', 'in_repair', 'archived', 'lost'], true)) {
            $query->where('status', $status);
        }

        $type = trim((string) $request->query('type', ''));
        if ($type !== '' && in_array($type, ['computer', 'phone', 'tablet', 'other'], true)) {
            $query->where('device_type', $type);
        }

        $sort = trim((string) $request->query('sort', 'updated_desc'));
        if (!in_array($sort, ['updated_desc', 'warranty_soon', 'status', 'last_event_desc'], true)) {
            $sort = 'updated_desc';
        }

        if ($sort === 'warranty_soon') {
            $query->orderByRaw('CASE WHEN warranty_end_date IS NULL THEN 1 ELSE 0 END')
                ->orderBy('warranty_end_date');
        } elseif ($sort === 'status') {
            $query->orderByRaw("CASE status WHEN 'active' THEN 1 WHEN 'in_repair' THEN 2 WHEN 'lost' THEN 3 WHEN 'archived' THEN 4 ELSE 5 END")
                ->orderByDesc('updated_at');
        } elseif ($sort === 'last_event_desc') {
            $query->orderByRaw('CASE WHEN events_max_happened_at IS NULL THEN 1 ELSE 0 END')
                ->orderByDesc('events_max_happened_at')
                ->orderByDesc('updated_at');
        } else {
            $query->orderByDesc('updated_at');
        }

        $devices = $query
            ->limit(1000)
            ->get()
            ->map(function (Device $device) {
                return [
                    'id' => $device->id,
                    'device_type' => $device->device_type,
                    'brand' => $device->brand,
                    'model' => $device->model,
                    'serial_number' => $device->serial_number,
                    'asset_tag' => $device->asset_tag,
                    'status' => $device->status,
                    'purchase_date' => $device->purchase_date?->toDateString(),
                    'warranty_end_date' => $device->warranty_end_date?->toDateString(),
                    'display_name' => $device->display_name,
                    'tickets_count' => (int) ($device->tickets_count ?? 0),
                    'last_event_at' => $device->events_max_happened_at,
                    'user' => $device->user ? [
                        'id' => $device->user->id,
                        'name' => trim(($device->user->first_name ?? '') . ' ' . ($device->user->last_name ?? '')),
                        'email' => $device->user->email,
                    ] : null,
                ];
            })
            ->values();

        return Inertia::render('Devices/Index', [
            'devices' => $devices,
            'filters' => [
                'q' => $search,
                'status' => $status,
                'type' => $type,
                'sort' => $sort,
            ],
        ]);
    }

    public function show(Device $device)
    {
        $viewer = Auth::user();
        if (!$viewer) {
            abort(403, 'Acces non autorise.');
        }

        if (!$this->canViewDevice($viewer, $device)) {
            abort(403, 'Acces non autorise.');
        }

        $device->load(['user:id,first_name,last_name,email,phone', 'events.technician:id,first_name,last_name']);

        $ticketQuery = Ticket::query()
            ->with(['assignee:id,first_name,last_name'])
            ->where('device_id', $device->id)
            ->orderByDesc('created_at');

        $tickets = $ticketQuery
            ->limit(200)
            ->get()
            ->map(fn(Ticket $ticket) => [
                'id' => $ticket->id,
                'title' => $ticket->title,
                'status' => $ticket->status,
                'priority' => $ticket->priority,
                'assignee' => $ticket->assignee ? trim(($ticket->assignee->first_name ?? '') . ' ' . ($ticket->assignee->last_name ?? '')) : null,
                'created_at' => $ticket->created_at?->toDateTimeString(),
                'updated_at' => $ticket->updated_at?->toDateTimeString(),
            ])
            ->values();

        $events = DeviceEvent::query()
            ->with(['technician:id,first_name,last_name'])
            ->where('device_id', $device->id)
            ->orderByDesc('happened_at')
            ->limit(300)
            ->get()
            ->map(fn(DeviceEvent $event) => [
                'id' => $event->id,
                'event_type' => $event->event_type,
                'summary' => $event->summary,
                'details' => $event->details,
                'happened_at' => $event->happened_at?->toDateTimeString(),
                'ticket_id' => $event->ticket_id,
                'technician' => $event->technician
                    ? trim(($event->technician->first_name ?? '') . ' ' . ($event->technician->last_name ?? ''))
                    : null,
            ])
            ->values();

        $stats = [
            'tickets_total' => Ticket::where('device_id', $device->id)->count(),
            'tickets_open' => Ticket::where('device_id', $device->id)->whereIn('status', ['open', 'in_progress', 'pending'])->count(),
            'events_total' => DeviceEvent::where('device_id', $device->id)->count(),
            'last_event_at' => DeviceEvent::where('device_id', $device->id)->max('happened_at'),
            'first_ticket_at' => Ticket::where('device_id', $device->id)->min('created_at'),
        ];

        return Inertia::render('Devices/Show', [
            'device' => [
                'id' => $device->id,
                'device_type' => $device->device_type,
                'brand' => $device->brand,
                'model' => $device->model,
                'display_name' => $device->display_name,
                'serial_number' => $device->serial_number,
                'asset_tag' => $device->asset_tag,
                'status' => $device->status,
                'purchase_date' => $device->purchase_date?->toDateString(),
                'warranty_start_date' => $device->warranty_start_date?->toDateString(),
                'warranty_end_date' => $device->warranty_end_date?->toDateString(),
                'vendor_name' => $device->vendor_name,
                'imei' => $device->imei,
                'sim_number' => $device->sim_number,
                'phone_number' => $device->phone_number,
                'os_name' => $device->os_name,
                'ram_gb' => $device->ram_gb,
                'storage_gb' => $device->storage_gb,
                'cpu' => $device->cpu,
                'notes' => $device->notes,
                'access_password' => $device->access_password,
                'no_access_password' => (bool) $device->no_access_password,
                'user' => $device->user ? [
                    'id' => $device->user->id,
                    'name' => trim(($device->user->first_name ?? '') . ' ' . ($device->user->last_name ?? '')),
                    'email' => $device->user->email,
                    'phone' => $device->user->phone,
                ] : null,
            ],
            'tickets' => $tickets,
            'events' => $events,
            'stats' => $stats,
            'isAgent' => (bool) $viewer->agent,
        ]);
    }

    public function storeEvent(Request $request, Device $device)
    {
        $viewer = Auth::user();
        if (!$viewer) {
            abort(403, 'Acces non autorise.');
        }

        if (!$viewer->agent) {
            abort(403, 'Action reservee aux agents.');
        }

        $data = $request->validate([
            'event_type' => 'required|in:battery_replaced,screen_replaced,storage_upgraded,diagnostic,maintenance,note',
            'summary' => 'required|string|max:500',
            'details' => 'nullable|string|max:3000',
            'happened_at' => 'nullable|date',
            'ticket_id' => 'nullable|integer|exists:tickets,id',
        ]);

        DeviceEvent::create([
            'device_id' => $device->id,
            'ticket_id' => $data['ticket_id'] ?? null,
            'technician_id' => $viewer->id,
            'event_type' => $data['event_type'],
            'summary' => $data['summary'],
            'details' => !empty($data['details']) ? ['note' => $data['details']] : null,
            'happened_at' => $data['happened_at'] ?? now(),
        ]);

        return back()->with('success', 'Evenement ajoute au suivi appareil.');
    }

    public function store(Request $request, User $user)
    {
        $validated = $request->validate([
            'device_type' => 'required|in:computer,phone,tablet,other',
            'brand' => 'nullable|string|max:120',
            'model' => 'required|string|max:120',
            'serial_number' => 'nullable|string|max:120|unique:devices,serial_number',
            'asset_tag' => 'nullable|string|max:120|unique:devices,asset_tag',
            'purchase_date' => 'nullable|date',
            'warranty_start_date' => 'nullable|date',
            'warranty_end_date' => 'nullable|date|after_or_equal:purchase_date',
            'vendor_name' => 'nullable|string|max:120',
            'status' => 'required|in:active,in_repair,archived,lost',
            'imei' => 'nullable|regex:/^[0-9]{15}$/|unique:devices,imei',
            'sim_number' => 'nullable|string|max:50',
            'phone_number' => 'nullable|string|max:50',
            'os_name' => 'nullable|string|max:100',
            'ram_gb' => 'nullable|integer|min:1|max:2048',
            'storage_gb' => 'nullable|integer|min:1|max:16384',
            'cpu' => 'nullable|string|max:120',
            'notes' => 'nullable|string|max:3000',
        ]);

        $validated['user_id'] = $user->id;

        Device::create($validated);

        return back()->with('success', 'Appareil ajoute avec succes.');
    }

    public function update(Request $request, User $user, Device $device)
    {
        if ((int) $device->user_id !== (int) $user->id) {
            abort(404);
        }

        $validated = $request->validate([
            'device_type' => 'required|in:computer,phone,tablet,other',
            'brand' => 'nullable|string|max:120',
            'model' => 'required|string|max:120',
            'serial_number' => 'nullable|string|max:120|unique:devices,serial_number,' . $device->id,
            'asset_tag' => 'nullable|string|max:120|unique:devices,asset_tag,' . $device->id,
            'purchase_date' => 'nullable|date',
            'warranty_start_date' => 'nullable|date',
            'warranty_end_date' => 'nullable|date|after_or_equal:purchase_date',
            'vendor_name' => 'nullable|string|max:120',
            'status' => 'required|in:active,in_repair,archived,lost',
            'imei' => 'nullable|regex:/^[0-9]{15}$/|unique:devices,imei,' . $device->id,
            'sim_number' => 'nullable|string|max:50',
            'phone_number' => 'nullable|string|max:50',
            'os_name' => 'nullable|string|max:100',
            'ram_gb' => 'nullable|integer|min:1|max:2048',
            'storage_gb' => 'nullable|integer|min:1|max:16384',
            'cpu' => 'nullable|string|max:120',
            'notes' => 'nullable|string|max:3000',
        ]);

        $device->update($validated);

        return back()->with('success', 'Appareil mis a jour.');
    }

    public function destroy(User $user, Device $device)
    {
        if ((int) $device->user_id !== (int) $user->id) {
            abort(404);
        }

        $device->delete();

        return back()->with('success', 'Appareil supprime.');
    }
}
