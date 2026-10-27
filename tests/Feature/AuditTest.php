<?php

use App\Models\Agent;
use App\Models\Audit;
use App\Models\AuditDevice;
use App\Models\Device;
use App\Models\DeviceEvent;
use App\Models\DiagAppToken;
use App\Models\Diagnostic;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function auditAgent(): User
{
    $user = User::factory()->create(['first_name' => 'Tim', 'last_name' => 'Tech']);
    Agent::create(['user_id' => $user->id, 'is_admin' => false, 'is_active' => true]);

    return $user;
}

function auditCompany(): User
{
    return User::factory()->create(['client_type' => User::TYPE_COMPANY, 'company_name' => 'Boulangerie Martin']);
}

function auditFor(User $client, User $agent): Audit
{
    return Audit::create(['user_id' => $client->id, 'technician_id' => $agent->id, 'title' => 'Audit annuel', 'status' => 'draft']);
}

function auditDiagPayload(array $inventory, string $machine = 'PC-ACCUEIL'): array
{
    return [
        'report' => json_encode([
            'format' => 'diag-atelier',
            'machine' => ['name' => $machine],
            'status' => ['overall' => 'crit', 'overallLabel' => 'Disque en fin de vie'],
            'viability' => ['score' => 41, 'level' => 'crit', 'verdict' => 'Remplacement conseillé'],
            'clientReport' => ['advice' => [['priority' => 'urgent', 'title' => 'Remplacer le disque dur']]],
        ]),
        'inventory' => json_encode($inventory),
        'state' => json_encode(['notes' => '']),
        'files' => [UploadedFile::fake()->createWithContent('Analyse.json', '{}')],
        'file_sources' => ['app'],
        'file_names' => ['Analyse.json'],
        'file_encodings' => ['plain'],
    ];
}

it('lets agents only create, list and open audits', function () {
    $agent = auditAgent();
    $company = auditCompany();

    $this->actingAs($agent)
        ->post(route('audits.store'), ['user_id' => $company->id, 'title' => 'Audit du parc'])
        ->assertRedirect();

    $audit = Audit::firstOrFail();
    expect($audit->status)->toBe('draft')
        ->and($audit->technician_id)->toBe($agent->id);

    $this->actingAs($agent)->get(route('audits.index'))->assertOk()
        ->assertInertia(fn ($page) => $page->component('Audits/Index')->has('audits', 1)->where('audits.0.client.name', 'Boulangerie Martin'));

    $this->actingAs($agent)->get(route('audits.show', $audit))->assertOk()
        ->assertInertia(fn ($page) => $page->component('Audits/Show')->where('audit.title', 'Audit du parc'));

    $this->actingAs($company)->get(route('audits.index'))->assertForbidden();
    $this->actingAs($company)->get(route('audits.show', $audit))->assertForbidden();
});

it('stores a network scan from PC2 Diag and turns hosts into devices', function () {
    $agent = auditAgent();
    $audit = auditFor(auditCompany(), $agent);
    [, $plain] = DiagAppToken::issue($agent, 'Clé USB');

    $this->withToken($plain)->withHeader('X-Diag-Machine', 'PC-TECH')
        ->postJson("/api/diag-app/audits/{$audit->id}/network-scans", [
            'subnet' => '192.168.1.0/24',
            'local_ip' => '192.168.1.20',
            'gateway' => '192.168.1.1',
            'duration_ms' => 4200,
            'add_devices' => true,
            'hosts' => [
                ['ip' => '192.168.1.1', 'mac' => 'aa-bb-cc-00-11-22', 'hostname' => 'livebox.home', 'kind' => 'router', 'ports' => [80, 443], 'gateway' => true],
                ['ip' => '192.168.1.30', 'mac' => 'AABBCC001133', 'kind' => 'printer', 'vendor' => 'Brother', 'ports' => [9100, 631]],
            ],
        ])
        ->assertCreated()
        ->assertJson(['host_count' => 2, 'devices_added' => 2]);

    $scan = $audit->networkScans()->firstOrFail();
    expect($scan->machine_name)->toBe('PC-TECH')
        ->and($scan->hosts[0]['mac'])->toBe('AA:BB:CC:00:11:22');

    $router = AuditDevice::where('ip', '192.168.1.1')->firstOrFail();
    expect($router->kind)->toBe('router')->and($router->name)->toBe('livebox')->and($router->source)->toBe('scan');
    expect(AuditDevice::where('ip', '192.168.1.30')->value('name'))->toBe('Brother');
    expect($audit->fresh()->status)->toBe('in_progress');

    // A second scan updates the devices instead of duplicating them
    $this->actingAs($agent)
        ->post(route('audits.scans.hosts', [$audit, $scan]), ['ips' => ['192.168.1.1', '192.168.1.30']])
        ->assertRedirect();
    expect($audit->devices()->count())->toBe(2);
});

it('saves a PC2 Diag diagnostic on the audit and fills the client device sheet', function () {
    Storage::fake('local');
    $agent = auditAgent();
    $company = auditCompany();
    $audit = auditFor($company, $agent);
    [, $plain] = DiagAppToken::issue($agent, 'Clé USB');

    $res = $this->withToken($plain)->withHeader('X-Diag-Machine', 'PC-ACCUEIL')
        ->post("/api/diag-app/audits/{$audit->id}/diagnostics", [
            ...auditDiagPayload(['brand' => 'Dell', 'model' => 'OptiPlex 7090', 'serial' => 'DL123']),
            'location' => 'Accueil',
            'assigned_to' => 'Julie',
        ])
        ->assertCreated()
        ->assertJsonPath('audit.id', $audit->id)
        ->assertJsonPath('device_created', true)
        ->json();

    $auditDevice = AuditDevice::findOrFail($res['audit_device']['id']);
    expect($auditDevice->status)->toBe('done')
        ->and($auditDevice->hostname)->toBe('PC-ACCUEIL')
        ->and($auditDevice->location)->toBe('Accueil')
        ->and($auditDevice->serial_number)->toBe('DL123');

    $device = Device::findOrFail($auditDevice->device_id);
    expect($device->user_id)->toBe($company->id)->and($device->brand)->toBe('Dell');
    expect(DeviceEvent::where('device_id', $device->id)->where('event_type', 'diagnostic')->exists())->toBeTrue();

    $diagnostic = Diagnostic::findOrFail($res['id']);
    expect($diagnostic->audit_device_id)->toBe($auditDevice->id)->and($diagnostic->ticket_id)->toBeNull();

    // Same serial again: same device of the audit, no new client device
    $this->withToken($plain)->withHeader('X-Diag-Machine', 'PC-ACCUEIL')
        ->post("/api/diag-app/audits/{$audit->id}/diagnostics", auditDiagPayload(['serial' => 'DL123']))
        ->assertCreated()
        ->assertJsonPath('audit_device.id', $auditDevice->id)
        ->assertJsonPath('device_created', false);
    expect(Device::count())->toBe(1)->and($auditDevice->diagnostics()->count())->toBe(2);

    // Audit diagnostics stay out of the quick diags
    $this->actingAs($agent)->get(route('diag.index'))
        ->assertInertia(fn ($page) => $page->has('diagnostics', 0));
    $this->actingAs($agent)->get(route('diag.diagnostics.show', $diagnostic))
        ->assertRedirect(route('audits.diagnostics.show', [$audit, $diagnostic]));

    $this->actingAs($agent)->get(route('audits.diagnostics.show', [$audit, $diagnostic]))
        ->assertOk()->assertSee('"audit":', false);
    $this->actingAs($agent)->get(route('audits.report', $audit))
        ->assertOk()->assertSee('Boulangerie Martin')->assertSee('Remplacer le disque dur');
});

it('does not link a serial number of another client', function () {
    Storage::fake('local');
    $agent = auditAgent();
    $audit = auditFor(auditCompany(), $agent);
    Device::create(['user_id' => User::factory()->create()->id, 'device_type' => 'computer', 'serial_number' => 'XX9']);

    $this->actingAs($agent)
        ->post(route('audits.devices.store', $audit), ['kind' => 'computer', 'name' => 'Poste compta'])
        ->assertRedirect();
    $auditDevice = $audit->devices()->firstOrFail();

    $this->actingAs($agent)
        ->post(route('audits.devices.diagnostics.store', [$audit, $auditDevice]), auditDiagPayload(['serial' => 'XX9', 'brand' => 'HP']), ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('device_created', true)
        ->assertJson(fn ($json) => $json->where('warnings.0', fn ($w) => str_contains($w, 'autre client'))->etc());

    expect(Device::where('serial_number', 'XX9')->count())->toBe(1);
});

it('deletes the diagnostics files with the audit', function () {
    Storage::fake('local');
    $agent = auditAgent();
    $audit = auditFor(auditCompany(), $agent);
    $auditDevice = $audit->devices()->create(['kind' => 'computer', 'name' => 'PC']);

    $id = $this->actingAs($agent)
        ->post(route('audits.devices.diagnostics.store', [$audit, $auditDevice]), auditDiagPayload([]), ['Accept' => 'application/json'])
        ->assertCreated()->json('id');
    Storage::disk('local')->assertExists("diagnostics/{$id}");

    $this->actingAs($agent)->delete(route('audits.destroy', $audit))->assertRedirect(route('audits.index'));

    expect(Audit::count())->toBe(0)->and(Diagnostic::count())->toBe(0);
    Storage::disk('local')->assertMissing("diagnostics/{$id}");
});
