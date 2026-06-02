<?php

namespace App\Http\Controllers;

use App\Models\Device;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class DeviceController extends Controller
{
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
                $q->where('brand', 'like', '%' . $search . '%')
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
